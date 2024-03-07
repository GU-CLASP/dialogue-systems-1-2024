import { assign, createActor, setup } from "xstate"; 
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure.js";

const inspector = createBrowserInspector();

const azureLanguageCredentials = {
  endpoint: "https://m-v-lab3.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview",
  key: NLU_KEY,
  deploymentName: "appointment",
  projectName: "appointment",
};

const azureCredentials = {
  endpoint: "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
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

const FamousPeople = {
  "Childish Gambino": "Donald Glover, also known by his stage name Childish Gambino, is an American multi-talented artist who has made a significant impact in the entertainment industry.",
  "Marvin Gaye": "is known as the Prince of Motown, was a legendary soul singer-producer-songwriter who fought for justice and equality in America.",
  "Anna Delvey": "Anna Sorokin, commonly known as Anna Delvey, is a con artist who posed as a wealthy heiress to access upper-class New York social and art scenes. She became famous after her Netflix show called Finding Anna was released.",
  "Mick Jagger": "Sir Michael Philip Jagger, more known as Mick Jagger, is the lead vocalist and one of the founders of The Rolling Stones, one of the longest-running and hugely successful bands ever.",
  "Stieg Larsson": "Karl Stig-Erland (Stieg) Larsson was a Swedish journalist and writer, best known for writing the Millenium trilogy crime novels, one of which is The Girl with the Dragon Tattoo. His works became loved after his passing.",
  "Rosa Parks": "Rosa Louise McCauley Parks was an American activist in the civil rights movement, best known for her pivotal role in the Montgomery bus boycott.",
  "Ella Fitzgerald": "Ella Jane Fitzgerald, dubbed as the first lady of song, was the most popular female jazz singer in the United States for more than half a century.",
  "Corey Taylor": "Corey Todd Taylor is the lead vocalist of the heavy metal bands Slipknot and Stone Sour, known for his powerful vocals and intense stage presence.",
  "Lea Salonga": "Maria Lea Carmen Imutan Salonga is a Filipina singer and actress, also known as the singing voice of Disney's Jasmine and Mulan.",
};

/* Helper functions */
function isInFamousPeople(utterance) {
  return utterance.toLowerCase() in FamousPeople;
}

function getFamousPeopleInf(utterance) {
  return FamousPeople[utterance.toLowerCase()] || "";
}

function MeetingIntent(event) {
  return event === "Create a meeting";
}

function WhoIsXIntent(event) {
  return event === "Who is X";
}

const verifyASRConfidence = ({ context, event }) => {
  const { confidence } = event || {};
  context.asrConfidenceThreshold = Math.max(confidence || 0, context.asrConfidenceThreshold - 0.1);
};

const verifyNLUConfidence = ({ context, event }) => {
  const { confidence } = event?.nluValue || {};
  context.nluConfidenceThreshold = Math.max(confidence || 0, context.nluConfidenceThreshold - 0.1);
};

const dmMachine = setup({
    
    actions: {
        listenUser: ({ context }) =>
          context.ssRef.send({
            type: "LISTEN",
            value: { nlu: true }
          }),
    
        speakUser: ({ context }, params) =>
          context.ssRef.send({
            type: "SPEAK",
            value: {
              utterance: params
            }
          })
      }
    }).createMachine({ 
        context: {
    celebrity: "",
    meeting_time: "",
    meeting_hour: "",
    noInputCounter: 0,
    asrInput: "",
    asrConfidenceThreshold: 0.7,
    nluConfidenceThreshold: 0.8,
  },
  initial: "Prepare",
  states: {
    Prepare: {
      entry: [
        assign({
          ssRef: ({ spawn }) => spawn(speechstate, { input: settings })
        }),
        ({ context }) => context.ssRef.send({ type: "PREPARE" })
      ],
      on: { ASRTTS_READY: "Prompt" }
    },

    Prompt: {
      entry: [{ type: "speakUser", params: `Hi, what can I do for you?` }],
      on: { SPEAK_COMPLETE: "Listen" }
    },

    Listen: {
      entry: "listenUser",
      on: {
        RECOGNISED: [
          {
            guard: ({ event }) => MeetingIntent(event?.nluValue?.topIntent),
            target: "WithWhom"
          },
          {
            guard: ({ event }) => WhoIsXIntent(event?.nluValue?.topIntent),
            actions: assign({
              celebrity: ({ event }) => event?.nluValue?.entities?.[0]?.text
            }),
            target: "ExtraInfo"
          },
          {
            target: "Noinput",
            actions: [
              assign({
                asrInput: ({ event }) => event?.nluValue?.topTranscript
              }),
              "incrementNoInputCounter"
            ]
          }
        ],
        ASR_NOINPUT: "Noinput"
      }
    },

    Noinput: {
      entry: [
        { type: "speakUser", params: `Sorry, I didn't hear you. Will the meeting take the whole day?` },
        { type: "incrementNoInputCounter" }
      ],
      on: { SPEAK_COMPLETE: "Noinput2" }
    },

    Noinput2: {
      entry: [
        { type: "speakUser", params: `Sorry, I didn't understand. Will the meeting take the whole day?.` },
        { type: "incrementNoInputCounter" }
      ],
      on: { SPEAK_COMPLETE: "Noinput3" }
    },

    Noinput3: {
        entry: [
          { type: "speakUser", params: `Sorry, I still didn't get that. Are you there?` },
          { type: "incrementNoInputCounter" }
        ],
        on: {
          SPEAK_COMPLETE: [
            { target: "Done", guard: "LimitReached" },
            { target: "Listen" }
          ]
        }
      },
      
    WithWhom: {
      entry: [
        { type: "speakUser", params: `With whom would you like to have a meeting with?` }
      ],
      on: { SPEAK_COMPLETE: "ListenPersonMeet" }
    },

    ListenPersonMeet: {
      entry: "listenUser",
      on: {
        RECOGNISED: {
          actions: assign({
            celebrity: ({ event }) => {
              const entity = event?.nluValue?.entities?.[0];
              return entity?.text ?? "";
            }
          }),
          target: "Day"
        },
        ASR_NOINPUT: {
          target: "Didntunderstand"
        }
      }
    },

    Didntunderstand: {
      entry: [
        {
          type: "speakUser",
          params: `I didn't understand, can you repeat?`
        }
      ],
      on: { SPEAK_COMPLETE: "WithWhom" }
    },

    Day: {
      entry: [
        {
          type: "speakUser",
          params: `On which day would you like to have a meeting?`
        }
      ],
      on: {
        SPEAK_COMPLETE: "TimeHour"
      }
    },

    TimeHour: {
      entry: "listenUser",
      on: {
        RECOGNISED: {
          actions: assign({
            meeting_time: ({ event }) => event?.nluValue?.entities?.[0]?.text
          }),
          target: "Time"
        },
        ASR_NOINPUT: {
          target: "ReRaise"
        }
      }
    },

    ReRaise: {
      entry: [
        {
          type: "speakUser",
          params: `I didn't understand, can you repeat?`
        }
      ],
      on: { SPEAK_COMPLETE: "Day" }
    },

    Time: {
      entry: [
        {
          type: "speakUser",
          params: `What time is the meeting going to take place?`
        }
      ],
      on: {
        SPEAK_COMPLETE: "ListenTime"
      }
    },

    ListenTime: {
      entry: "listenUser",
      on: {
        RECOGNISED: {
          actions: assign({
            meeting_hour: ({ event }) => event?.nluValue?.entities?.[0]?.text
          }),
          target: "Verification"
        },
        ASR_NOINPUT: {
          target: "ReRaise1"
        }
      }
    },

    ReRaise1: {
      entry: [
        {
          type: "speakUser",
          params: `I didn't understand, can you repeat?`
        }
      ],
      on: { SPEAK_COMPLETE: "Time" }
    },

    Verification: {
      entry: [
        {
          type: "speakUser",
          params: ({ context }) =>
            `You want to create an appointment at ${context.meeting_hour} with ${context.celebrity} on ${context.meeting_time}, let's proceed.`
        }
      ],
      on: { SPEAK_COMPLETE: "ExtraInfo" }
    },

    ExtraInfo: {
      entry: [
        {
          type: "speakUser",
          params: ({ context }) =>
            isInFamousPeople(context.celebrity) ?
              `In order to prepare your meeting with ${context.celebrity}, here is some information you would want to know. ${getFamousPeopleInf(context.celebrity).information}` :
              `I don't have information about ${context.celebrity}.`
        }
      ],
      on: {
        SPEAK_COMPLETE: "Done"
      }
    },

    Done: {
      entry: [{ type: "speakUser", params: `Enjoy your meeting!` }],
      on: { CLICK: "Prompt" }
    }
  },
  on: {
    "ASR_REC": {
      actions: ["verifyASRConfidence", "verifyNLUConfidence"]
    }
  }
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect
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
