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
    speechRecognitionEndpointId: "353f01c2-b749-463a-98e2-8ff7f0f29484", // add Endpoint ID for Custom Speech
};

const grammar = {
    catuai: { word: "catuai" },
};

/* Helper functions */
function isInGrammar(utterance) {
    return utterance.toLowerCase() in grammar;
}

// analogous to dm.js
const dmMachine = setup({
    actions: {
      say: ({ context }, params) =>
        context.ssRef.send({
          type: "SPEAK",
          value: {
            utterance: `${params}`,
          },
        }),
    },
  }).createMachine({
    context: {
      word: 'catuai'
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
          CLICK: "Main",
        },
      },
      Main:{
        initial: "Prompt",
        states: {
          Prompt:{
          entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Let's try to test your Automatic Speech Recognition model."),
          on: { SPEAK_COMPLETE: "AskWord" },
          },        
          AskWord: {
          entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Which word do you want to test?"),
          on: { SPEAK_COMPLETE: "GetWord" },
          },
          GetWord: {
            entry: ({ context }) => context.ssRef.send({ type: "LISTEN" }),
            on: {
                RECOGNISED: {
                  actions: ({ context, event }) =>
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `You just said: ${
                          event.value[0].utterance
                        }. And the word in context is ${context.word}, the word I recognized ${
                          isInGrammar(event.value[0].utterance) ? "is" : "is not"
                        } in the grammar.`,
                      },
                    })
                },
                SPEAK_COMPLETE: "RecognitionCompleted",
              },
            },
          RecognitionCompleted: {
            entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Great! Your model test has been completed!"),
            SPEAK_COMPLETE: "#DM.Done",
          }
        }
      },
      Done: {
        on: {
          CLICK: "Main",
        },
      },
    },
  });
  
const dmActor = createActor(dmMachine, {
    inspect: inspector.inspect,
  }).start();
  
dmActor.subscribe((state) => {
    console.log(state)
  });
  
export function setupButton(element) {
    element.addEventListener("click", () => {
      dmActor.send({ type: "CLICK" });
    });
    dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
      element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
    });
  }
  
function sendSpeechCommand(ssRef, type, utterance) {
 ssRef.send({ type, value: { utterance } });
}
