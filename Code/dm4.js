import { assign, createActor, setup } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure.js";

const inspector = createBrowserInspector();

const azureLanguageCredentials = {
  endpoint: "https://annis-lab4.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview",
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
  azureLanguageCredentials: azureLanguageCredentials /** global activation of NLU */,
  azureCredentials: azureCredentials,
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};
        

//Defining our NLU intents
const intents = {
  celebrityInfo: "WhoIsX",
  BookMeeting: "CreateMeeting"
}

/* Helper functions */
function isInGrammar(utterance) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}

function checkIntent(event) {
  //
}

const dmMachine = setup({
  actions: {
    listenForUsersAnswer : ({ context }) => 
    context.ssRef.send({
       type: "LISTEN", value: { nlu: true } }),

    speakToTheUser : ({ context }, params) => 
    context.ssRef.send({
       type: "SPEAK",
      value: {
        utterance: params
      },
    }),
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
          entry: [{ type: "speakToTheUser", params: `How can I help you today?`}],
          on: { SPEAK_COMPLETE: "Listen" },
        },

        Listen: {
          entry: "listenForUsersAnswer",

          on: {
            RECOGNISED: {
              actions: ({ context, event }) =>
                context.ssRef.send({
                  type: "SPEAK",
                  value: {
                    utterance: `You just said: ${event.value[0].utterance}. And it's confidence score is ${event.value[0].}`,
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
  guards: {
    matchesGrammar: (context, event) => {
      // check if player won
      return isInGrammar(event.value[0]);
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