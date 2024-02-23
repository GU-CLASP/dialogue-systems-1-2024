dm3.js
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
  speechRecognitionEndpointId: "https://m-v-lab3.cognitiveservices.azure.com/"
};
const dmMachine = setup({
    actions: {
      listen : ({context}) =>
      context.ssRef.send({
        type: "LISTEN"
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
        on: { ASRTTS_READY: "Listen" },
      },

      Listen: {
            entry :  "listen",
        on : {
            RECOGNISED : {
                actions : ({event}) => console.log(event.value[0].confidence)
        }
        }
    }
},
});

  const dmActor = createActor(dmMachine, {
    inspect: inspector.inspect,
  }).start();

  export function setupButton(element) {
    element.addEventListener("click", () => {
      dmActor.send({ type: "CLICK" });
    });
    dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
      element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
    });
  }
  