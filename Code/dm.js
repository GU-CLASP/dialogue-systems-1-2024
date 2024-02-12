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

function createSlotFillingState(params) {
  var onRecognised = params.onRecognised;
  if(onRecognised == null) {
    onRecognised = [
      {
        guard: ({ context, event }) => !!getEntity(event, params.entity),
        target: params.nextState,
        actions: ({ context, event }) => {
          context[params.slot] = getEntity(event, params.entity)
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
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: params.prompt,
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
            RECOGNISED: onRecognised,
            ASR_NOINPUT: {
              target: "heard_nothing"
            },
          },
        },
        nomatch: {
          entry: ({ context }) =>
            context.ssRef.send({type: "SPEAK", value: { utterance: "Sorry, I didn't understand." }}),
          on: { SPEAK_COMPLETE: "Listen" },
        },
        heard_nothing: {
          entry: ({ context }) =>
            context.ssRef.send({type: "SPEAK", value: { utterance: "I didn't hear you." }}),
          on: { SPEAK_COMPLETE: "Prompt" },
        },
      }
    };
}

function confirmationUtterance(context) {
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

const dmMachine = setup({
  actions: {
    /* define your actions here */
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
    },
    PromptAndAsk: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: ({ context }) =>
            context.ssRef.send({type: "SPEAK", value: { utterance: `Hello!` }}),
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
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: `Let's create an appointment`,
              },
            }),
          on: {
            SPEAK_COMPLETE: "#DM.AskName",
          }
        }
      }
    },
    AskName: createSlotFillingState({
      prompt: `Who are you meeting with?`,
      slot: 'person',
      entity: 'person',
      nextState: '#DM.AskDay'}),
    AskDay: createSlotFillingState({
      prompt: `On which day is your meeting?`,
      slot: 'day',
      entity: 'day',
      nextState: '#DM.AskWholeDay'}),
    AskWholeDay: createSlotFillingState({
      prompt: `Will it take the whole day?`,
      slot: 'whole_day',
      entity: 'boolean',
      onRecognised: [
          {
            guard: ({ context, event }) => (getEntity(event, 'boolean') == true),
            target: "#DM.ConfirmCreateMeeting",
          },
          {
            guard: ({ context, event }) => (getEntity(event, 'boolean') == false),
            target: "#DM.AskTime",
          },
          {
            target: "nomatch",
          },
        ]
    }),
    AskTime: createSlotFillingState({
      prompt: `What time is your meeting?`,
      slot: 'time',
      entity: 'time',
      nextState: '#DM.ConfirmCreateMeeting'}),
    ConfirmCreateMeeting: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: confirmationUtterance(context),
              },
            }),
          on: { SPEAK_COMPLETE: "Listen" },
        },
        Listen: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
            }),
        },
      }
    },
    Done: {
      on: {
        CLICK: "PromptAndAsk",
      },
    },
  },
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
