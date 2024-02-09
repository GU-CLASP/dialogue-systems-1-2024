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
};

/* Helper functions */

function getEntity(event, entity) {
  var utterance = event.value[0].utterance.toLowerCase();
  if(utterance in grammar) {
    var interpretation = grammar[utterance];
    return interpretation[entity];
  }
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
              actions: ({ context, event }) =>
                context.ssRef.send({
                  type: "SPEAK",
                  value: {
                    utterance: `Let's create an appointment`,
                  },
                }),
            },
            SPEAK_COMPLETE: "#DM.AskName",
          },
        },
      },
    },
    AskName: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: `Who are you meeting with?`,
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
                guard: ({ context, event }) => !!getEntity(event, 'person'),
                target: '#DM.ConfirmCreateMeeting',
                actions: ({ context, event }) => {
                  context.person = getEntity(event, 'person')
                },
              },
              {
                target: "nomatch",
              },
            ],
          },
        },
        nomatch: {
          entry: ({ context }) =>
            context.ssRef.send({type: "SPEAK", value: { utterance: "Sorry, I didn't understand." }}),
          on: { ENDSPEECH: "Prompt" },
        },
      }
    },
    ConfirmCreateMeeting: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: `Do you want me to create a meeting with ` + context.person + `?`,
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
