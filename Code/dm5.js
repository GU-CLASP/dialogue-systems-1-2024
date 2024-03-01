import { Actor, and, assign, createActor, setup } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure.js";
import { NLU_KEY } from "./azure.js";

const inspector = createBrowserInspector();

const azureLanguageCredentials = {
    endpoint: "https://languageresource12.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview" ,
    key: NLU_KEY,
    deploymentName: "appointment" ,
    projectName: "appointment",
  };

  const azureCredentials = {
    endpoint:
      "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
    key: KEY,
  };
  
const settings = {
    azureLanguageCredentials: azureLanguageCredentials ,
    azureCredentials: azureCredentials,
    asrDefaultCompleteTimeout: 0,
    asrDefaultNoInputTimeout: 5000,
    locale: "en-US",
    ttsDefaultVoice: "en-US-DavisNeural",
  };

/* Grammar definition */
const grammar = {
  'Tom Holland' : 'actor' , 
  'Ryan Reynolds' : 'actor',
  'Tatiany Maslany' : 'actress',
   'Salma Hayek' : 'actress',
  'The Flash' : 'superhero',
  'Queen Elisabeth II' : 'queen',
  'Emily Dickinson' : 'poet',
  'Britney Spears' : 'singer',
  'Big Time Rush' : 'boy band',
};


/* Helper functions */
function whoIsX(utterance) {
    return grammar[utterance];
}
function isInGrammar(utterance) {
    return utterance in grammar;
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
    listen : ({context}) =>
    context.ssRef.send({
      type: "LISTEN",
      value: { nlu: true },
    }),
  },
}).createMachine({
  context: {
    re_prompt_count: 0,
    famous_person : "",
    person : "",
    day : "",
    time: ""
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
      after : {
        10000 : { target : "#DM.PromptAndAsk.Prompt"}
      },
      on: {
        CLICK: "PromptAndAsk",
      },
    },
    PromptAndAsk: {
      initial: "Prompt",
      states: {
        Prompt: {
            entry : [{
                type : "say",
                params : `Hi,how can I help you today?`
              }],
            on : {SPEAK_COMPLETE : "ListenToChooseIntent"},
        },
        ListenToChooseIntent : {
            entry : "listen",
        on : {  ASR_NOINPUT : [
                {guard: ({context})=> context.re_prompt_count<=1, 
                target: "CantHear",
                actions : ({context})=> context.re_prompt_count++},
                {guard: ({context})=> context.re_prompt_count >1,
                target : "#DM.Done" }
                        ],
            RECOGNISED : [
                {guard : and([({event}) => event.nluValue.topIntent == "create a meeting", ({event})=> event.nluValue.intents[0].confidenceScore >=0.8]),
                target : "Ask"},
                {guard : and ([({event}) =>  event.nluValue.topIntent == "Who is X", ({event}) => isInGrammar(event.nluValue.entities[0].text), ]),
                target : "FamousPerson",
                actions : assign({ famous_person : ({event}) => event.nluValue.entities[0].text })},
                {guard : ({event}) =>  event.nluValue.topIntent == "Who is X" , 
                actions : [assign({ famous_person : ({event}) => event.nluValue.entities[0].text }),
                {type : "say", params : ({context}) => `I have no idea who ${context.famous_person} is.`}],
                target : "#DM.Done"},
                {target : "IntentNotRecognised"} 
        ]
        }
        },
        CantHear : {
            entry : [{
                type : "say",
                params : `I didn't hear you.`
              }],
              on : {SPEAK_COMPLETE : "#DM.PromptAndAsk.Prompt"},
            },
        FamousPerson : {
            entry: [{
                type : "say",
                params : ({context}) => `${context.famous_person} is a famous ${whoIsX(context.famous_person)}`
              }],
              on : {SPEAK_COMPLETE : "#DM.Done"}
            },
        IntentNotRecognised : {
            entry : [{
                type : "say",
                params : `I am sorry I can't help you with that.`
              }],
        },
        Ask: {
          entry: [{
            type : "say",
            params : `Who are you meeting with?`
          }],
          on: { SPEAK_COMPLETE : "ListenForPerson"},
        },
        ListenForPerson :{
            entry : [{
            type : "listen"
          }],
          on : {
            RECOGNISED : {
                actions : assign({ person : ({event}) => event.nluValue.entities[0].text }),
                target : "DayQuestion"
            }
          }
        },
        DayQuestion : {
          entry : [{
            type: "say",
            params : `On which day are you meeting?`
          }],
          on : {SPEAK_COMPLETE : "Day"}
        },
        Day: {
          entry : [{
            type : "listen"
          }],
          on : {
            RECOGNISED : {
                actions : assign({ day : ({event}) => event.nluValue.entities[0].text }),
                target : "WholeDay"
            }
          }
        },
    WholeDay : {
      entry : [{
        type : "say",
        params : `Will it take the whole day?`
      }],
      on : {SPEAK_COMPLETE : "WholeDayOrNot"},
    },
    WholeDayOrNot: {
      entry : [{
        type: "listen"
      }],
      on : {
        RECOGNISED : [
          {
         guard : ({event}) => event.nluValue.entities[0].category == "positive",
         target : "CheckInfo"
        },
        {target : "TimeQuestion"},
        ],
      },
  },
  CheckInfo : {
    entry : [{
      type: "say",
      params : ({context}) => `Do you want me to create an appointment with ${context.person} on ${context.day} for the whole day?`
    }],
 on : {SPEAK_COMPLETE : "ListenCheckInfo"},
  },
  ListenCheckInfo : {
    entry : [{
      type: "listen"
    }],
    on : {
      RECOGNISED : [
        {
        guard : ({event}) => event.nluValue.entities[0].category == "positive",
        target : "AppointmentCreated"
      },
      {target : "Ask"},
      ],
    },
  },
  AppointmentCreated : {
    entry : [{
      type : "say",
      params : `Your appointment has been created!`
    }],
    on : {SPEAK_COMPLETE : "#DM.Done"}
  },
  TimeQuestion : {
    entry : [{
      type: "say",
      params : `What time is your meeting?`
    }],
  on : {SPEAK_COMPLETE: "Time"}
  },
  Time : {
    entry : [{
      type : "listen"
    }],
    on : {
        RECOGNISED : {
            actions : assign({ time : ({event}) => event.nluValue.entities[0].text || event.nluValue.utterance}),
            target : "CheckAllInfo"
        }
      }
    },
  CheckAllInfo : {
    entry : [{
      type: "say",
      params : ({context}) => `Do you want me to create an appointment with ${context.person} on ${context.day} at ${context.time}?`
    }],
    on : {SPEAK_COMPLETE:"ListenCheckInfo"},
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
