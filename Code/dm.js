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
const grammar_person = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  rasmus: { person: "Rasmus Blanck" },
  marry: { person: "Marry" },
  tom: { person: "Tom" },
  black: { person: "Black" },
  jerry: { person: "Jerry" },
};

const grammar_day = {
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  wednesday: { day: "Wednesday" },
  thursday: { day: "Thursday" },
  friday: { day: "Friday" },
};

const grammar_time = {
  "8": { time: "8:00" },
  "9": { time: "9:00" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  "12": { time: "12:00" },
  "13": { time: "13:00" },
  "14": { time: "14:00" },
  "15": { time: "15:00" },
  "16": { time: "16:00" },
};

const grammar_positive_answer = {
  "yes": { answer: "Yes" },
  "of course": { answer: "Of course" },
  "yeah": { answer: "Yeah" },
};

const grammar_negative_answer = {
  "no": { answer: "No" },
  "no way": { answer: "No way"},
};

/* Helper functions */
function isInPersonGrammar(utterance) {
  return utterance.toLowerCase() in grammar_person;
}

function isInDayGrammar(utterance) {
  return utterance.toLowerCase() in grammar_day;
}

function isInTimeGrammar(utterance) {
  return utterance.toLowerCase() in grammar_time;
}

function getPerson(utterance) {
  return (grammar_person[utterance.toLowerCase()] || {}).person;
}

function getDate(utterance) {
  return (grammar_day[utterance.toLowerCase()] || {}).day;
}

function getTime(utterance) {
  return (grammar_time[utterance.toLowerCase()] || {}).time;
}

function isYes(utterance) {
  return utterance.toLowerCase() in grammar_positive_answer;
}

function isNo(utterance) {
  return utterance.toLowerCase() in grammar_negative_answer;
}


const dmMachine = setup({
  actions: {
    /* define your actions here */
    say: ({ context }, params) =>
      context.ssRef.send({
      type: "SPEAK",
      value: {
        utterance: params,
    },
  }),
  },
}).createMachine({
  context: {
    count: 0,
    person: undefined,
    date: undefined,
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
        CLICK: "PromptAndAsk",
      },
    },
    PromptAndAsk: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry:[{type: "say", params:`Let's create an appointment`}],
          on: { SPEAK_COMPLETE: "#DM.WithWhom" },
        },
      },
    },
    WithWhom: {
      initial: "Who",
      id: "who",
      states: {
        Who: {
          entry: [{type: "say", params:`Who are you meeting with?`}],
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
              value: { 
                noInputTimeOut: 1000
              }
            }),
          on: { 
            RECOGNISED: 
              [{
                guard: ({ event }) => isInPersonGrammar(event.value[0].utterance) === true,
                actions: [
                  ({ context, event }) => { context.person = getPerson(event.value[0].utterance) },
                ],
                target: "#DM.WhichDate",    
              },
              {
                guard: ({ event }) => isInPersonGrammar(event.value[0].utterance) === false,
                target: "#DM.NotPersonGram",
              }],
            ASR_NOINPUT:"#DM.NoPersonVoice", 
            },
        },
      },
    },
    /* Not received voice */
    NoPersonVoice: {
      initial: "Novoice",
      states: {
        Novoice: {
          entry: [{type: "say", params:`I didn’t hear you`}],
          on: {            
            SPEAK_COMPLETE: "#DM.WithWhom"
            },

        },

      },
    },
    /* Not in grammar */
    NotPersonGram: {
      initial: "Notgram",
      states: {
        Notgram: {
          entry: [{type: "say", params:`The word is not in Gramma. Please answer the question again`}],
          on: {            
            SPEAK_COMPLETE: "#DM.WithWhom"
          },
        },

      },
    },
    WhichDate: {
      initial: "Whichdate",
      states: {
        Whichdate: {
          entry: [{type: "say", params:`On which day is your meeting?`}],
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
              value: { 
                noInputTimeOut: 1000     
              }
            }),
            on: { 
              RECOGNISED: 
                [
                {
                  guard: ({ event }) => isInDayGrammar(event.value[0].utterance) === true,
                  actions: [
                    ({ context, event }) => { context.date = getDate(event.value[0].utterance) },
                  ],
                  target: "#DM.WholeDay",    
                },
                {
                  guard: ({ event }) => isInDayGrammar(event.value[0].utterance) === false,
                  target: "#DM.NotDateGram",
                },
                ],
              ASR_NOINPUT:"#DM.NoDateVoice", 
            },
        },
      },
    },
    /* Not received voice */
    NoDateVoice: {
      initial: "Novoice",
      states: {
        Novoice: {
          entry: [{type: "say", params:`I didn’t hear you`}],
          on: {            
            SPEAK_COMPLETE: "#DM.WhichDate"        
            },
        },
      },
    },
    /* Not in grammar */
    NotDateGram: {
      initial: "Notgram",
      states: {
        Notgram: {
          entry: [{type: "say", params:`The word is not in Gramma. Please answer the question again`}],
          on: {            
            SPEAK_COMPLETE: "#DM.WhichDate"
          },
        },
      },
    },
    WholeDay: {
      initial: "Whole",
      states: {
        Whole: {
          
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: `Will it take the whole day?`,
              },
            }),
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
              value: { 
                noInputTimeOut: 1000     
              }
            }),     
            on: { 
              RECOGNISED: 
                [{
                  guard: ({ event }) => isYes(event.value[0].utterance) === true,
                  target: "#DM.CreateWholeDay",    
                },
                {
                  guard: ({ event }) => isNo(event.value[0].utterance) === true,
                  target: "#DM.WhatTime",
                },
                "#DM.NotWholeDayGram"
              ],
              ASR_NOINPUT:"#DM.NoWholeDayVoice", 
              },
        },
      },
    },
    /* Not received voice */
    NoWholeDayVoice: {
      initial: "Novoice",
      states: {
        Novoice: {
          entry: [{type: "say", params:`I didn’t hear you`}],
          on: {            
            SPEAK_COMPLETE: "#DM.WholeDay"        
          },
        },
      },
    },
    /* Not in grammar */
    NotWholeDayGram: {
      initial: "Notgram",
      states: {
        Notgram: {
          entry: [{type: "say", params:`The word is not in Gramma. Please answer the question again`}],
          on: {            
            SPEAK_COMPLETE: "#DM.WholeDay"
          },
        },
      },
    },
    CreateWholeDay: {
      initial: "Createwhole",
      states: {
        Createwhole: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: `Do you want me to create an appointment with ${context.person} on ${context.date} for the whole day?`,
              },
            }),
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
              value: { 
                noInputTimeOut: 1000
              }}),
          on: { 
            RECOGNISED: 
              [{
                guard: ({ event }) => isYes(event.value[0].utterance) === true,
                target: "#DM.FinishAppointment",    
              },
              {
                guard: ({ event }) => isNo(event.value[0].utterance) === true,
                target: "#DM.WithWhom",
              },
              "#DM.NotCreateWholeDayGram"
              ],
            ASR_NOINPUT: "#DM.NoCreateWholeDayVoice", 
          },
        },
      },
    },
    /* Not received voice */
    NoCreateWholeDayVoice: {
      initial: "Novoice",
      states: {
        Novoice: {
          entry: [{type: "say", params:`I didn’t hear you`}],
          on: {            
            SPEAK_COMPLETE: "#DM.CreateWholeDay"        
          } 
        },
      },
    },
    /* Not in grammar */
    NotCreateWholeDayGram: {
      initial: "Notgram",
      states: {
        Notgram: {
          entry: [{type: "say", params:`The word is not in Gramma. Please answer the question again`}],
          on: {            
            SPEAK_COMPLETE: "#DM.CreateWholeDay"
          },
        },
      },
    },
    WhatTime: {
      initial: "Whattime",
      states: {
        Whattime: {
          entry: [{type: "say", params:`What time is your meeting?`}],
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
              value: { 
                noInputTimeOut: 1000 
              }
            }),
            on: { 
              RECOGNISED: 
                [
                {
                  guard: ({ event }) => isInTimeGrammar(event.value[0].utterance) === true,
                  actions: [
                    ({ context, event }) => { context.time = getTime(event.value[0].utterance) },
                  ],
                  target: "#DM.CreateTime",    
                },
                {
                  guard: ({ event }) => isInTimeGrammar(event.value[0].utterance) === false,
                  target: "#DM.NotTimeGram",
                },
                "#DM.NotTimeGram"],
              ASR_NOINPUT: "#DM.NoTimeVoice", 
           },
        },
      },
    },
    /* Not received voice */
    NoTimeVoice: {
      initial: "Novoice",
      states: {
        Novoice: {
          entry: [{type: "say", params:`I didn’t hear you`}],
          on: {            
            SPEAK_COMPLETE: "#DM.WhatTime"        
          },
        },
      },
    },
    /* Not in grammar */
    NotTimeGram: {
      initial: "Notgram",
      states: {
        Notgram: {
          entry: [{type: "say", params:`The word is not in Gramma. Please answer the question again`}],
          on: {            
            SPEAK_COMPLETE: "#DM.WhatTime"
          },
        },
      },
    },
    CreateTime: {
      initial: "Createtime",
      states: {
        Createtime: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: `Do you want me to create an appointment with ${context.person} on ${context.date} at ${context.time}?`,
              },
            }),
          on: { SPEAK_COMPLETE: "Ask" },
        },
        Ask: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
              value: { 
                noInputTimeOut: 1000
                
              }
            }),
          on: { 
            RECOGNISED: 
              [{
                guard: ({ event }) => isYes(event.value[0].utterance) === true,
                target: "#DM.FinishAppointment",    
              },
              {
                guard: ({ event }) => isNo(event.value[0].utterance) === true,
                target: "#DM.WithWhom",
              },
              "#DM.NotCreateTimeGram"
              ],
            ASR_NOINPUT: "#DM.NoCreateTimeVoice", 
          },
        },
      },
    },
    /* Not received voice */
    NoCreateTimeVoice: {
      initial: "Novoice",
      states: {
        Novoice: {
          entry: [{type: "say", params:`I didn’t hear you`}],
          on: {            
            SPEAK_COMPLETE: "#DM.CreateTime"        
          },
        },
      },
    },
    /* Not in grammar */
    NotCreateTimeGram: {
      initial: "Notgram",
      states: {
        Notgram: {
          entry: [{type: "say", params:`The word is not in Gramma. Please answer the question again`}],
          on: {            
            SPEAK_COMPLETE: "#DM.CreateTime"
          },
        },
      },
    },
    FinishAppointment: {
      initial: "Finishappointment",
      states: {
        Finishappointment: {
          entry: [{type: "say", params:`Your appointment has been created!`}],
          on: { SPEAK_COMPLETE: "#DM.Done" },
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

/*SetTimeout for start automatically*/
export function setupButton(element) {
  element.addEventListener("click", 
  () => {
    setTimeout(function(){
      dmActor.send({ type: "CLICK" });}, 100)
  });
  setTimeout(function(){
    dmActor.send({ type: "CLICK" });}, 1000);
  setTimeout(function(){
    
    dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
      element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
    });
  
  }, 10)
 
}

