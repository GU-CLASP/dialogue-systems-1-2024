// -*- js-indent-level: 2 -*-
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
  andreas: { person: "Andreas Henriksson" },

  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  wednesday: { day: "Wednesday" },
  thursday: { day: "Thursday" },
  friday: { day: "Friday" },
  saturday: { day: "Saturday" },
  sunday: { day: "Sunday" },

  tomorrow: { day: "tomorrow" },
  "the day after tomorrow": { day: "The day after tomorrow" },

  "10": { time: "10:00" },
  "11": { time: "11:00" },
  "12": { time: "12:00" },
  "13": { time: "13:00" },
  // ...
};

/* Helper functions */
function isInGrammar(utterance) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}

function getDay(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).day;
}

function getTime(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).time;
}


const yesGrammar = new Set([
  "yes", "yeah", "of course", "sure", "yup",
]);
const noGrammar = new Set([
  "no", "nope", "no way", "nah",
]);

function isYes(utterance) {
  return yesGrammar.has(utterance.toLowerCase());
}

function isNo(utterance) {
  return noGrammar.has(utterance.toLowerCase());
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
    listen: ({ context }, params) =>
      context.ssRef.send({
        type: "LISTEN",
        value: {}, // workaround for some incompatibility I encountered
      }),
  },
}).createMachine({
  context: {
    name: undefined,
    date: undefined,
    take_whole_day: undefined,
    time: undefined,
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
        CLICK: "ReceiveGreeting",
      },
    },
    ReceiveGreeting: {
      entry: ["listen"],
      on: {
        // move on to the next state after any utterance or when no input was received
        RECOGNISED: "Greet",
        ASR_NOINPUT: "Greet",
      },
    },
    Greet: {
      entry: [{type: 'say', params: "Let's create an appointment"}],
      on: { SPEAK_COMPLETE: "AskName" },
    },
    AskName: {
      entry: [
        {type: 'say', params: "Who are you meeting with?"},
      ],
      on: {
        SPEAK_COMPLETE: { actions: ["listen"] },
        RECOGNISED: [
          {
            guard: ({ context, event }) => getPerson(event.value[0].utterance) !== undefined,
            actions: [
              ({ context, event }) => { context.name = getPerson(event.value[0].utterance) },
            ],
            target: "AskDay",
          },
          "UnknownAskName",
        ],
        ASR_NOINPUT: "ResetAskName",
      },
    },
    ResetAskName: {
      entry: [{ type: 'say', params: "I didn't hear you" }],
      on: { SPEAK_COMPLETE: "AskName" },
    },
    UnknownAskName: {
      entry: [{ type: 'say', params: "I didn't understand" }],
      on: { SPEAK_COMPLETE: "AskName" },
    },

    AskDay: {
      entry: [
        {type: 'say', params: "On which day is your meeting?"},
      ],
      on: {
        SPEAK_COMPLETE: { actions: ["listen"] },
        RECOGNISED: [
          {
            guard: ({ context, event }) => getDay(event.value[0].utterance) !== undefined,
            actions: [
              ({ context, event }) => { context.date = getDay(event.value[0].utterance) },
            ],
            target: "AskTakeWholeDay",
          },
          "UnknownAskDay",
        ],
        ASR_NOINPUT: "ResetAskDay",
      },
    },
    ResetAskDay: {
      entry: [{ type: 'say', params: "I didn't hear you" }],
      on: { SPEAK_COMPLETE: "AskDay" },
    },
    UnknownAskDay: {
      entry: [{ type: 'say', params: "I didn't understand" }],
      on: { SPEAK_COMPLETE: "AskDay" },
    },

    AskTakeWholeDay: {
      entry: [
        {type: 'say', params: "Will it take the whole day?"},
      ],
      on: {
        SPEAK_COMPLETE: { actions: ["listen"] },
        RECOGNISED: [
          {
            guard: ({ context, event }) => isYes(event.value[0].utterance),
            target: "BookDay",
          },
          {
            guard: ({ context, event }) => isNo(event.value[0].utterance),
            target: "AskTime",
          },
          "UnknownAskTakeWholeDay",
        ],
        ASR_NOINPUT: "ResetAskTakeWholeDay",
      },
    },
    ResetAskTakeWholeDay: {
      entry: [{ type: 'say', params: "I didn't hear you" }],
      on: { SPEAK_COMPLETE: "AskTakeWholeDay" },
    },
    UnknownAskTakeWholeDay: {
      entry: [{ type: 'say', params: "I didn't understand" }],
      on: { SPEAK_COMPLETE: "AskTakeWholeDay" },
    },

    AskTime: {
      entry: [
        {type: 'say', params: "What time is your meeting?"},
      ],
      on: {
        SPEAK_COMPLETE: { actions: ["listen"] },
        RECOGNISED: [
          {
            guard: ({ context, event }) => getTime(event.value[0].utterance) !== undefined,
            actions: [
              ({ context, event }) => { context.time = getTime(event.value[0].utterance) },
            ],
            target: "BookTime",
          },
          "UnknownAskTime",
        ],
        ASR_NOINPUT: "ResetAskTime",
      },
    },
    ResetAskTime: {
      entry: [{ type: 'say', params: "I didn't hear you" }],
      on: { SPEAK_COMPLETE: "AskTime" },
    },
    UnknownAskTime: {
      entry: [{ type: 'say', params: "I didn't understand" }],
      on: { SPEAK_COMPLETE: "AskTime" },
    },

    BookTime: {
      entry: [{
        type: 'say',
        params: ({ context }) => `Do you want me to create an appointment with ${context.name} on ${context.date} at ${context.time}?`,
      }],
      on: {
        SPEAK_COMPLETE: { actions: ["listen"] },
        RECOGNISED: [
          {
            guard: ({ context, event }) => isYes(event.value[0].utterance),
            target: "Finalize",
          },
          {
            guard: ({ context, event }) => isNo(event.value[0].utterance),
            target: "AskName",
          },
          "UnknownBookTime",
        ],
        ASR_NOINPUT: "ResetBookTime",
      },
    },
    ResetBookTime: {
      entry: [{ type: 'say', params: "I didn't hear you" }],
      on: { SPEAK_COMPLETE: "BookTime" },
    },
    UnknownBookTime: {
      entry: [{ type: 'say', params: "I didn't understand" }],
      on: { SPEAK_COMPLETE: "BookTime" },
    },

    BookDay: {
      entry: [{
        type: 'say',
        params: ({ context }) => `Do you want me to create an appointment with ${context.name} on ${context.date} for the whole day?`,
      }],
      on: {
        SPEAK_COMPLETE: { actions: ["listen"] },
        RECOGNISED: [
          {
            guard: ({ context, event }) => isYes(event.value[0].utterance),
            target: "Finalize",
          },
          {
            guard: ({ context, event }) => isNo(event.value[0].utterance),
            target: "AskName",
          },
          "UnknownBookDay",
        ],
        ASR_NOINPUT: "ResetBookDay",
      },
    },
    ResetBookDay: {
      entry: [{ type: 'say', params: "I didn't hear you" }],
      on: { SPEAK_COMPLETE: "BookDay" },
    },
    UnknownBookDay: {
      entry: [{ type: 'say', params: "I didn't understand" }],
      on: { SPEAK_COMPLETE: "BookDay" },
    },

    Finalize: {
      entry: [{
        type: 'say',
        params: ({ context }) => "Your appointment has been created!",
      }],
      on: {
        SPEAK_COMPLETE: "#DM.WaitToStart",
      }
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
