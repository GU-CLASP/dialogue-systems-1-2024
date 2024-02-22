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
  speechRecognitionEndpointId: "9b09e345-46df-4373-ad70-a5968bf2e815",
};


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
        CLICK: "ASR",
      },
    },
    Greet: {
      entry: [{type: 'say', params: "hi!"}],
      on: { SPEAK_COMPLETE: "ASR" },
    },
    ASR: {
      entry: ["listen"],
      on: {
        // move on to the next state after any utterance or when no input was received
        RECOGNISED: {
          actions: [
            ({ context, event }) => {
              console.log();
              console.log(`Utterance:  '${event.value[0].utterance}'`);
              console.log(`Confidence: '${event.value[0].confidence}'`);
              console.log();
            }
          ],
          target: "#DM.WaitToStart",
        },
        ASR_NOINPUT: {
          target: "#DM.WaitToStart",
        },
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
