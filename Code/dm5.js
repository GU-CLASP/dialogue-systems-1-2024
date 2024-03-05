import { assign, createActor, setup } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure.js";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const settings = {
  azureCredentials: azureCredentials,
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

/* Grammar definition */
const grammar = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  rasmus: { person: "Rasmus Blanck" },
  alex: { person: "Alex Berman" },
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  "alex on monday": { person: "Alex Berman", day: "Monday" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  yes: { boolean: true },
  no: { boolean: false },
  help: { intent: "help" },
};

/* Helper functions */

function getEntity(event, entity) {
  var utterance = event.value[0].utterance.toLowerCase();
  if(utterance in grammar) {
    var interpretation = grammar[utterance];
    return interpretation[entity];
  }
}

function getIntent(event) {
  var utterance = event.value[0].utterance.toLowerCase();
  if(utterance in grammar) {
    var interpretation = grammar[utterance];
    return interpretation.intent;
  }
}


const slots = [
  {name: 'person', entity: 'person'},
  {name: 'day', entity: 'day'},
  {name: 'whole_day', entity: 'boolean'},
  {name: 'time', entity: 'time'},
];


const helpState = {
  entry: ({ context }) =>
    context.ssRef.send({type: "SPEAK", value: { utterance: "I'm a digital assistant that can help you book meetings." }}),
  on: { SPEAK_COMPLETE: "Prompt" },
};


function createState(params) {
  var onEntry = params.onEntry;
  if(onEntry == null) {
    onEntry = ({ context }) => {
      if(context[params.slot]) {
        slots.forEach((slot) => {
          var value = context[slot.name];
          if(!value) {
            dmActor.send({type: "jump_to_ask_" + slot.name});
          }
        });
      }
      else {
        context.ssRef.send({
          type: "SPEAK",
          value: {
            utterance: params.prompt,
          },
        });
      }
    };
  }

  var onRecognised = [
    {
      guard: ({ context, event }) => (getIntent(event) == 'help'),
      target: "help",
    }
  ];
  if(params.onRecognised != null) {
    onRecognised = onRecognised.concat(params.onRecognised);
  } else {
    if(params.slot != null) {
      onRecognised = onRecognised.concat([
        {
          guard: ({ context, event }) => !!getEntity(event, params.entity),
          target: params.nextState,
          actions: ({ context, event }) => {
            slots.forEach((slot) => {
              var value = getEntity(event, slot.entity);
              if(value) {
                context[slot.name] = value;
              }
            });
          },
        },
        {
          guard: ({ context, event }) => (getIntent(event) == 'help'),
          target: "help",
        },
        {
          target: "nomatch",
        },
      ]);
    }
  }
  if(params.slot == null) {
    onRecognised.push({
      target: params.nextState ? params.nextState : "nomatch"
    });
  }

  return {
      initial: "Prompt",
      entry: ({ context }) => { context.noInputCount = 0 },
      states: {
        Prompt: {
          entry: onEntry,
          on: { SPEAK_COMPLETE: "Listen" },
        },
        Listen: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
            }),
          on: {
            RECOGNISED: onRecognised,
            ASR_NOINPUT: [
              {
                guard: ({ context, event }) => (context.noInputCount >= 3),
                target: "#DM.Done"
              },
              {
                target: params.onNoInput ? params.onNoInput : "heard_nothing"
              }
            ],
          },
        },
        nomatch: {
          entry: ({ context }) =>
            context.ssRef.send({type: "SPEAK", value: { utterance: params.noMatchResponse }}),
          on: { SPEAK_COMPLETE: "Prompt" },
        },
        heard_nothing: {
          entry: ({ context }) => {
            context.ssRef.send({type: "SPEAK", value: { utterance: "I didn't hear you." }});
            context.noInputCount += 1;
          },
          on: { SPEAK_COMPLETE: "Prompt" },
        },
        help: helpState,
      }
    };
}

function confirmationQuestionUtterance(context) {
  var utterance = `Do you want me to create an appointment with ${context.person} on ${context.day} `;
  if(context.time) {
    utterance += `at ${context.time}`;
  }
  else {
    utterance += `the whole day`;
  }
  utterance += `?`;
  return utterance;
}

function createJumpTosForSlots() {
  var result = {};
  slots.forEach((slot) => {
    result["jump_to_ask_" + slot.name] = "#DM.ask_" + slot.name;
  });
  return result;
}

const dmMachine = setup({
  actions: {
    say: ({ context }, params) =>
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: params,
        },
      }),
  },
}).createMachine({
  context: {
    count: 0,
    person: null,
  },
  id: "DM",
  initial: "Prepare",
  states: {
    Prepare: {
      entry: [
        assign({
          ssRef: ({ spawn }) => spawn(speechstate, { input: settings }),
        }),
        ({ context }) => context.ssRef.send({ type: "PREPARE" }),
      ],
      on: { ASRTTS_READY: "WaitToStart" },
    },
    WaitToStart: {
      on: {
        CLICK: "PromptAndAsk",
      },
      after: {
        10000: { target: 'PromptAndAsk' },
      },
    },
    PromptAndAsk: createState({
      prompt: `Hello!`,
      nextState: "#DM.InitiateCreateAppointment",
      onNoInput: "#DM.InitiateCreateAppointment",
    }),
    InitiateCreateAppointment: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: [{
              type: "say",
              params: `Let's create an appointment`,
            }],
          on: {
            SPEAK_COMPLETE: "#DM.ask_person",
          }
        }
      }
    },
    ask_person: createState({
      prompt: `Who are you meeting with?`,
      slot: 'person',
      entity: 'person',
      noMatchResponse: "Sorry, I didn't understand. Please answer with a name.",
      nextState: '#DM.ask_day'}),
    ask_day: createState({
      prompt: `On which day is your meeting?`,
      slot: 'day',
      entity: 'day',
      noMatchResponse: "Sorry, I didn't understand. Please answer with a day.",
      nextState: '#DM.ask_whole_day'}),
    ask_whole_day: createState({
      prompt: `Will it take the whole day?`,
      slot: 'whole_day',
      entity: 'boolean',
      noMatchResponse: "Sorry, I didn't understand. Please answer yes or no.",
      onRecognised: [
          {
            guard: ({ context, event }) => (getEntity(event, 'boolean') == true),
            target: "#DM.AskConfirmCreateMeeting",
          },
          {
            guard: ({ context, event }) => (getEntity(event, 'boolean') == false),
            target: "#DM.ask_time",
          },
        ]
    }),
    ask_time: createState({
      prompt: `What time is your meeting?`,
      slot: 'time',
      entity: 'time',
      noMatchResponse: "Sorry, I didn't understand. Please answer with a time.",
      nextState: '#DM.AskConfirmCreateMeeting'}),
    AskConfirmCreateMeeting: createState({
      onEntry: ({ context }) => {
        context.ssRef.send({
          type: "SPEAK",
          value: {
            utterance: confirmationQuestionUtterance(context),
          },
        });
      },
      noMatchResponse: "Sorry, I didn't understand. Please answer yes or no.",
      onRecognised: [
        {
          guard: ({ context, event }) => (getEntity(event, 'boolean') == true),
          target: "#DM.ConfirmCreatedMeeting",
        },
        {
          guard: ({ context, event }) => (getEntity(event, 'boolean') == false),
          target: "#DM.ask_person",
        },
      ]
    }),
    ConfirmCreatedMeeting: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: [{
              type: "say",
              params: 'Your meeting has been created!',
            }],
        },
      },
    },
    Done: {
      on: {
        CLICK: "PromptAndAsk",
      },
    },
  },
  on: createJumpTosForSlots(),
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  /* if you want to log some parts of the state */
});

export function setupButton(element) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
    element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
  });
}
