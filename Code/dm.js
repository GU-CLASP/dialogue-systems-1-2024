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
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
};

/* Helper functions */
function isInGrammar(utterance) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}

const dmMachine = setup({
  actions: {
    /* define your actions here */
  },
}).createMachine({
  context: {
    count: 0,
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
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: `Hello world!`,
              },
            }),
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
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
                    utterance: `You just said: ${
                      event.value[0].utterance
                    }. And it ${
                      isInGrammar(event.value[0].utterance) ? "is" : "is not"
                    } in the grammar.`,
                  },
                }),
            },
            SPEAK_COMPLETE: "#DM.Done",
          },
        },
      },
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
