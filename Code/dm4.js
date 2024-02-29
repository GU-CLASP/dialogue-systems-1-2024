// -*- js-indent-level: 2 -*-
import { assign, createActor, setup } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure.js";

const inspector = createBrowserInspector();

const azureLanguageCredentials = {
  endpoint: "https://dialogue2024123.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview",
  key: NLU_KEY,
  deploymentName: "appointment",
  projectName: "appointment",
};

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const settings = {
  azureLanguageCredentials: azureLanguageCredentials,
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


function hasCelebrity(nluValue) {
  return nluValue.entities.length == 1 && nluValue.entities[0].category === "celebrity";
}

function getCelebrity(nluValue) {
  console.assert(nluValue.entities[0].extraInformation[0].extraInformationKind === "ListKey");

  const celebrity = nluValue.entities[0].extraInformation[0].key;
  return celebrity;
}

// from Wikipedia
const explainCelebrityText = {
  "Johnny Cash": "Johnny Cash was an American country singer-songwriter. He was known for his deep, calm, bass-baritone voice.",
  "Laura Les": "Laura Les is an American music producer, singer and songwriter best known as one half of experimental electronic duo 100 gecs.",
};

function explainCelebrity(celebrity) {
  return explainCelebrityText[celebrity];
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
    listen_nlu: ({ context }, params) =>
      context.ssRef.send({
        type: "LISTEN",
        value: { nlu: true },
      }),
  },
}).createMachine({
  context: {},
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
        CLICK: {
          target: "ReceiveInstruction",
          actions: [
            ({ context, event }) => {
              context.name = undefined;
              context.date = undefined;
              context.take_whole_day = undefined;
              context.time =  undefined;

              context.celebrity = undefined;
            },
          ],
        },
      },
    },
    ReceiveInstruction: {
      entry: ["listen_nlu"],
      on: {
        RECOGNISED: [
          {
            guard: ({ context, event }) => event.nluValue.topIntent === "create_meeting",
            actions: [
              ({ context, event }) => {
                for (const entity of event.nluValue.entities) {
                  // set person
                  if (entity.category === "person" ) {
                    for (const extra_info of entity.extraInformation) {
                      if (extra_info.extraInformationKind === "ListKey")
                        context.name = extra_info.key;
                    }
                    console.assert(context.name !== undefined); // there should be a listkey in that array
                  }
                  // set day and/or time
                  if (entity.category === "day" ) {
                    // assume the first resolution is correct
                    const resolution = entity.resolutions[0];

                    console.assert(resolution.resolutionKind === "DateTimeResolution");

                    // TODO: this is probably a bit too hacky
                    const [date, time] = resolution.timex.split("T");

                    if (date)
                      context.date = date;
                    if (time) {
                      context.time = time;
                      context.take_whole_day = false;
                    }
                  }
                }
                console.log(context);
              },
            ],
            target: "PreAskName",
          },
          {
            guard: ({ context, event }) => event.nluValue.topIntent === "who_is_x" && hasCelebrity(event.nluValue),
            actions: [
              ({ context, event }) => { context.celebrity = getCelebrity(event.nluValue); },
            ],
            target: "ExplainCelebrity",
          },
          {
            target: "UnknownReceiveInstruction",
          },
        ],
        ASR_NOINPUT: "ResetReceiveInstruction",
      },
    },
    ResetReceiveInstruction: {
      entry: [{ type: 'say', params: "I didn't hear you" }],
      on: { SPEAK_COMPLETE: "ReceiveInstruction" },
    },
    UnknownReceiveInstruction: {
      entry: [{ type: 'say', params: "I didn't understand" }],
      on: { SPEAK_COMPLETE: "ReceiveInstruction" },
    },

    PreAskName: {
      always: [
        {
          guard:  ({ context, event }) => context.name === undefined,
          target: "AskName",
        },
        {
          // skip ahead if name was given
          target: "PreAskDay",
        },
      ],
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
            target: "PreAskDay",
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

    PreAskDay: {
      always: [
        {
          guard:  ({ context, event }) => context.date === undefined,
          target: "AskDay",
        },
        {
          // skip ahead if day was given
          target: "PreAskTakeWholeDay",
        },
      ],
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
            target: "PreAskTakeWholeDay",
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

    PreAskTakeWholeDay: {
      always: [
        {
          guard:  ({ context, event }) => context.take_whole_day === undefined,
          target: "AskTakeWholeDay",
        },
        {
          // skip ahead if we already know
          target: "PreAskTime",
        },
      ],
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
            target: "PreAskTime",
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

    PreAskTime: {
      always: [
        {
          guard:  ({ context, event }) => context.time === undefined,
          target: "AskTime",
        },
        {
          // skip ahead if time was given
          target: "BookTime",
        },
      ],
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

    ExplainCelebrity: {
      entry: [{
        type: 'say',
        params: ({ context }) => explainCelebrity(context.celebrity),
      }],
      on: {
        SPEAK_COMPLETE: "#DM.WaitToStart",
      },
    }
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
