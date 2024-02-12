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
};

/* Helper functions */

function getEntity(event, entity) {
  var utterance = event.value[0].utterance.toLowerCase();
  if(utterance in grammar) {
    var interpretation = grammar[utterance];
    return interpretation[entity];
  }
}

const slots = [
  {name: 'person', entity: 'person'},
  {name: 'day', entity: 'day'},
  {name: 'whole_day', entity: 'boolean'},
  {name: 'time', entity: 'time'},
];

function createSlotFillingState(params) {
  function onEntry(context) {
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
  }

  var onRecognised = params.onRecognised;
  if(onRecognised == null) {
    onRecognised = [
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
        target: "nomatch",
      },
    ]
  }
  return {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: ({ context }) => onEntry(context),
          on: { SPEAK_COMPLETE: "Listen" },
        },
        Listen: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
            }),
          on: {
            RECOGNISED: onRecognised,
            ASR_NOINPUT: {
              target: "heard_nothing"
            },
          },
        },
        nomatch: {
          entry: ({ context }) =>
            context.ssRef.send({type: "SPEAK", value: { utterance: "Sorry, I didn't understand." }}),
          on: { SPEAK_COMPLETE: "Prompt" },
        },
        heard_nothing: {
          entry: ({ context }) =>
            context.ssRef.send({type: "SPEAK", value: { utterance: "I didn't hear you." }}),
          on: { SPEAK_COMPLETE: "Prompt" },
        },
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
    PromptAndAsk: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: [{
              type: "say",
              params: `Hello!`,
            }],
          on: { SPEAK_COMPLETE: "AfterSystemGreeting" },
        },
        AfterSystemGreeting: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
            }),
          on: {
            RECOGNISED: {
              target: '#DM.InitiateCreateAppointment'
            },
            ASR_NOINPUT: {
              target: '#DM.InitiateCreateAppointment'
            },
          },
        },
      },
    },
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
    ask_person: createSlotFillingState({
      prompt: `Who are you meeting with?`,
      slot: 'person',
      entity: 'person',
      nextState: '#DM.ask_day'}),
    ask_day: createSlotFillingState({
      prompt: `On which day is your meeting?`,
      slot: 'day',
      entity: 'day',
      nextState: '#DM.ask_whole_day'}),
    ask_whole_day: createSlotFillingState({
      prompt: `Will it take the whole day?`,
      slot: 'whole_day',
      entity: 'boolean',
      onRecognised: [
          {
            guard: ({ context, event }) => (getEntity(event, 'boolean') == true),
            target: "#DM.AskConfirmCreateMeeting",
          },
          {
            guard: ({ context, event }) => (getEntity(event, 'boolean') == false),
            target: "#DM.ask_time",
          },
          {
            target: "nomatch",
          },
        ]
    }),
    ask_time: createSlotFillingState({
      prompt: `What time is your meeting?`,
      slot: 'time',
      entity: 'time',
      nextState: '#DM.AskConfirmCreateMeeting'}),
    AskConfirmCreateMeeting: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: confirmationQuestionUtterance(context),
              },
            }),
          on: { SPEAK_COMPLETE: "Listen" },
        },
        Listen: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
            }),
          on: {
            RECOGNISED: [
              {
                guard: ({ context, event }) => (getEntity(event, 'boolean') == true),
                target: "#DM.ConfirmCreatedMeeting",
              },
              {
                guard: ({ context, event }) => (getEntity(event, 'boolean') == false),
                target: "#DM.ask_person",
              },
              {
                target: "nomatch",
              },
            ],
            ASR_NOINPUT: {
              target: "heard_nothing"
            },
          },
        },
        nomatch: {
          entry: [{
              type: "say",
              params: "Sorry, I didn't understand.",
            }],
          on: { SPEAK_COMPLETE: "Prompt" },
        },
        heard_nothing: {
          entry: [{
              type: "say",
              params: "I didn't hear you.",
            }],
          on: { SPEAK_COMPLETE: "Prompt" },
        },
      }
    },
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
