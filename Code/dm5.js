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
  vlad: [{ person: "Vladislav Maraev", confidence: 1 }],
  aya: [{ person: "Nayat Astaiza Soriano", confidence: 1 }],
  rasmus: [{ person: "Rasmus Blanck", confidence: 1 }],
  alex: [{ person: "Alex Berman", confidence: 1 }],
  monday: [{ day: "Monday", confidence: 1 }],
  tuesday: [{ day: "Tuesday", confidence: 1 }],
  sunday: [
    { day: "Sunday", confidence: 0.7 },
    { person: "Sunday Rose", confidence: 0.7 },
  ],
  "alex on monday": [{ person: "Alex Berman", day: "Monday", confidence: 1 }],
  "10": [{ time: "10:00", confidence: 1 }],
  "11": [{ time: "11:00", confidence: 1 }],
  yes: [{ boolean: true, confidence: 1 }],
  no: [{ boolean: false, confidence: 1 }],
  help: [{ intent: "help", confidence: 1 }],
};


const asrConfidenceThreshold = 0.6;
const interpretationConfidenceThreshold = 0.8;


/* Helper functions */

function getEntity(event, entity) {
  var utterance = event.value[0].utterance.toLowerCase();
  if(utterance in grammar) {
    var interpretations = grammar[utterance];
    var result = null;
    interpretations.forEach((interpretation) => {
      if(interpretation[entity] != null) {
        result = interpretation[entity];
      }
    });
    return result;
  }
}

function getInterpretationConfidence(event, entity) {
  var utterance = event.value[0].utterance.toLowerCase();
  if(utterance in grammar) {
    var interpretations = grammar[utterance];
    var result = null;
    interpretations.forEach((interpretation) => {
      if(interpretation[entity] != null) {
        result = interpretation.confidence;
      }
    });
    return result;
  }
}
function getIntent(event) {
  var utterance = event.value[0].utterance.toLowerCase();
  if(utterance in grammar) {
    var interpretation = grammar[utterance];
    return interpretation.intent;
  }
}

function getAsrConfidence(event) {
  return event.value[0].confidence;
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
        // The transitions below are guarded by the presence of a relevant answer to the current question
        {
          // If both ASR and NLU confidence for the entity under discussion are above the configured thresholds,
          // integrate all the interpreted slot values that are above the interpretation threshold
          guard: ({ context, event }) =>
            (!!getEntity(event, params.entity) &&
            getAsrConfidence(event) >= asrConfidenceThreshold &&
            getInterpretationConfidence(event, params.entity) >= interpretationConfidenceThreshold),
          target: params.nextState,
          actions: ({ context, event }) => {
            slots.forEach((slot) => {
              var value = getEntity(event, slot.entity);
              if(value) {
                if(getInterpretationConfidence(event, slot.entity) >= interpretationConfidenceThreshold) {
                  context[slot.name] = value;
                }
              }
            });
          },
        },
        {
          // Else, if NLU confidence for the entity under discussion is below the threshold,
          // ask for semantic confirmation
          guard: ({ context, event }) =>
            (!!getEntity(event, params.entity) &&
            getInterpretationConfidence(event, params.entity) < interpretationConfidenceThreshold),
          target: "AskForInterpretationConfirmation",
          actions: ({ context, event }) => {
            context.eventToConfirm = event;
          },
        },
        {
          // Else, ASR confidence must be below the threshold, so ask for perceptual confirmation
          guard: ({ context, event }) => !!getEntity(event, params.entity),
          target: "AskForPerceptualConfirmation",
          actions: ({ context, event }) => {
            context.eventToConfirm = event;
          },
        },
        // The transitions below can be triggered in the absence of a relevant answer to the current question
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

  function generatePerceptualConfirmationQuestion(event) {
    return getEntity(event, params.entity) + ', did I hear correctly?'
  }

  function generateInterpretationConfirmationQuestion(event) {
    return getEntity(event, params.entity) + ', did I understand correctly?'
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
        AskForPerceptualConfirmation: {
          entry: ({ context, event }) =>
            context.ssRef.send({type: "SPEAK", value: { utterance: generatePerceptualConfirmationQuestion(event) }}),
          on: { SPEAK_COMPLETE: "ListenAfterAskingForConfirmation" },
        },
        AskForInterpretationConfirmation: {
          entry: ({ context, event }) =>
            context.ssRef.send({type: "SPEAK", value: { utterance: generateInterpretationConfirmationQuestion(event) }}),
          on: { SPEAK_COMPLETE: "ListenAfterAskingForConfirmation" },
        },
        ListenAfterAskingForConfirmation: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
            }),
          on: {
            RECOGNISED: [
              {
                guard: ({ context, event }) => (getEntity(event, 'boolean') == true),
                target: params.nextState,
                actions: ({ context, event }) => {
                  var value = getEntity(context.eventToConfirm, params.entity);
                  context[params.slot] = value;
                },
              },
              {
                target: "Prompt",
              },
            ],
            ASR_NOINPUT: "Prompt",
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
