import { and, assign, createActor, setup } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure.js";
import { NLU_KEY } from "./azure.js";
import { sortAndDeduplicateDiagnostics } from "typescript";
/*
Regarding improveingNLU coverage, I think I need to add more time datas and person datas to the model.
*/
  const inspector = createBrowserInspector();
  const azureLanguageCredentials = {
    endpoint: "https://languageresource58888.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview" /** your Azure CLU prediction URL */,
    key: NLU_KEY /** reference to your Azure CLU key */,
    deploymentName: "appointment" /** your Azure CLU deployment */,
    projectName: "appointment" /** your Azure CLU project name */,
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
 
  function getThreshold(thre) {
    return thre > 0.85;
  }
  function whoIntent(event) {
    return event === "who is adam lambert";
  }
  function meetIntent(event) {
    return event === "create a meeting";
  }

  /*
  The ASR threshold is the event.value[0].confidence. So we can use the similar function like getASRThreshold(event.value[0].confidence)
  to judge the correction. We can use both of event.nluValue.intents[0].confidenceScore and event.value[0].confidence
  as condition for confirmation. For example:

  getASRThreshold(event.value[0].confidence) === true && getThreshold(event.nluValue.intents[0].confidenceScore) === true
  to test the model. 
  
  
  */
 
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
        listen:({ context }) =>
            context.ssRef.send({
            type: "LISTEN",
            value: { nlu: true } /** Local activation of NLU */,
        }),
    },
  }).createMachine({
    context: {
      count: 0,
      // for Who is X part
      age: undefined,
      birthday: undefined,

      // for creating meeting part
      weekdate: undefined,
      meeting_name: undefined,
  
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
            entry:[{type: "say", params:`Let's start conversation`}],
            on: { SPEAK_COMPLETE: "#DM.ProposeQ" },
          },
        },
      },
      /* jump to one of two questions */
      ProposeQ: {
        initial: "proposeQ",
        states: {
        proposeQ: {
            entry: [{type: "say", params:`What's your question?`}],
            on: { SPEAK_COMPLETE: "Ask" },
          },
          Ask: {
            entry: "listen",
            on: { 
              RECOGNISED: 
                [
                {
                  guard: (({event}) => meetIntent(event.nluValue.topIntent) && getThreshold (event.nluValue.intents[0].confidenceScore)),
                  target: "#DM.WhichDate",    
                },
                {
                  guard: (({event}) => meetIntent(event.nluValue.topIntent) && !!(getThreshold (event.nluValue.intents[0].confidenceScore))),
                  target: "#DM.WhichDate",    
                },
                {
                  guard: (({event}) => whoIntent(event.nluValue.topIntent) && getThreshold (event.nluValue.intents[0].confidenceScore)),
                  target: "#DM.WhoisAdam",
                },
                {
                  guard: (({event}) => whoIntent(event.nluValue.topIntent) && !!(getThreshold (event.nluValue.intents[0].confidenceScore))),
                  target: "#DM.WhoisAdam",
                },
                {
                  guard: ({ event }) => event.nluValue.topIntent === "help" || "Help",
                  target: "#DM.HelpQ",
                },
                "#DM.NotQGrammar",

                ],
              ASR_NOINPUT:[{
                guard: ({context}) => context.count >= 3,
                target: "#DM.Done",
              },
              {
                guard: ({context}) => context.count < 3,
                actions:({context})=> context.count++,
                target: "#DM.NoQVoice",
              }],
            },
          },
        },
      },
      MakeSureWhichDate:{
        initial: "makeSureWhichDate",
        states: {
          makeSureWhichDate: {
            entry: [{type: "say", params:`Do you say create a meeting?`}],
            on: {             
              SPEAK_COMPLETE: "#DM.WhichDate"
              },
          },
        },
      },
      MakeSureWho:{
        initial: "makeSureWho",
        states: {
          makeSureWho: {
            entry: [{type: "say", params:`who is adam lambert`}],
            on: {             
              SPEAK_COMPLETE: "#DM.WhoisAdam"
              },
          },
        },
      },
      /* Not received voice */
      NoQVoice: {
        initial: "Novoice",
        states: {
          Novoice: {
            entry: [{type: "say", params:`I didn’t hear you`}],
            on: {            
              SPEAK_COMPLETE: "#DM.ProposeQ"
              },
          },
        },
      },
      /* Not in grammar */
      NotQGrammar: {
        initial: "notQGrammar",
        states: {
          notQGrammar: {
            entry: [{type: "say", params:`Sorry, I didn't understand. What's your question?, please say "create a meeting" or "who is Adam Lambert"`}],
            on: {             
              SPEAK_COMPLETE: "#DM.ProposeQ"
              },
          },
        },
      },
      /* help */
      HelpQ: {
        initial: "helpQ",
        states: {
          helpQ: {
            entry: [{type: "say", params:`You need help?`}],
            on: {            
              SPEAK_COMPLETE: "#DM.ProposeQ"
              },
          },
        },
      },

      /* Meeting Time */
      //Answer e.g. Monday to Friday
      WhichDate: {
        initial: "whichDate",
        states: {
          whichDate: {
            entry: [{type: "say", params:`On which date is the meeting?`}],
            on: {            
              SPEAK_COMPLETE: "Ask"
            },
          },
          Ask: {
            entry: "listen",
              on: { 
                RECOGNISED: 
                  [
                  {
                    guard: ({ event }) => event.nluValue.entities[0].text == "Monday" || "Tuesday" || "Wednesday" || "Thursday" || "Friday",
                    actions: [
                      ({ context, event }) => { context.weekdate = event.nluValue.entities[0].text},
                    ],
                    target: "#DM.MeetingTitle",    
                  },
                  {
                    guard: ({ event }) => event.nluValue.topIntent == "help" ,
                    target: "#DM.HelpWhichDate",
                  },
                  "#DM.NotWhichDateGrammar",
                  ],
                ASR_NOINPUT:[{
                    guard: ({context}) => context.count >= 3,
                    target: "#DM.Done",
                  },
                  {
                    guard: ({context}) => context.count < 3,
                    actions:({context}) => context.count++,
                    target: "#DM.NoWhichDateVoice",
                  }],
              },
          },
        },
      },
      /* Not received voice */
      NoWhichDateVoice: {
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
      NotWhichDateGrammar: {
        initial: "notWhichDateGrammar",
        states: {
          notWhichDateGrammar: {
            entry: [{type: "say", params:`Sorry, I didn't understand. What's your question?, please say from Monday to Friday`}],
            on: {    
              SPEAK_COMPLETE: "#DM.WhichDate"
              },
          },
        },
      },
     /* help */
     HelpWhichDate: {
        initial: "helpWhichDate",
        states: {
          helpWhichDate: {
            entry: [{type: "say", params:`You need help?`}],
            on: {            
              SPEAK_COMPLETE: "#DM.WhichDate"
              },
          },
        },
      },      
      /* Meeting Title */
      //Answer e.g. "departmental meeting" || "meeting" || "virtual meeting"
      MeetingTitle: {
        initial: "meetingTitle",
        states: {
          meetingTitle: {
            entry: [{type: "say", params:`What's the meeting title?`}],
            on: {            
              SPEAK_COMPLETE: "Ask"
            },
          },
          Ask: {
            entry: "listen",
              on: { 
                RECOGNISED: 
                  [
                  {
                    //Answer e.g. "departmental meeting" || "meeting" || "virtual meeting"
                    guard: ({ event }) => event.nluValue.entities[0].text == "departmental meeting" || "meeting" || "virtual meeting",
                    actions: [
                      ({ context, event }) => { context.meeting_name = event.nluValue.entities[0].text},
                    ],
                    target: "#DM.MeetingInfo",    
                  },
                  {
                    guard: ({ event }) => event.nluValue.topIntent == "help" ,
                    target: "#DM.HelpMeetingTitle",
                  },
                  "#DM.NotMeetingTitleGrammar"
                  ],
                ASR_NOINPUT:[{
                    guard: ({context}) => context.count >= 3,
                    target: "#DM.Done",
                  },
                  {
                    guard: ({context}) => context.count < 3,
                    actions:({context}) => context.count++,
                    target: "#DM.NoMeetingTitleVoice",
                  }], 
              },
          },
        },
      },
      /* Not received voice */
      NoMeetingTitleVoice: {
        initial: "Novoice",
        states: {
          Novoice: {
            entry: [{type: "say", params:`I didn’t hear you`}],
            on: {            
              SPEAK_COMPLETE: "#DM.MeetingTitle"
              },
          },
        },
      }, 
      /* Not in grammar */
      NotMeetingTitleGrammar: {
        initial: "notMeetingTitleGrammar",
        states: {
           notMeetingTitleGrammar: {
            entry: [{type: "say", params:`Sorry, I didn't understand. What's your question?, please say departmental meeting or meeting or virtual meeting`}],
            on: { 
              SPEAK_COMPLETE: "#DM.MeetingTitle"
              },
          },
        },
      },
     /* help */
     HelpMeetingTitle: {
        initial: "helpMeetingTitle",
        states: {
          helpMeetingTitle: {
            entry: [{type: "say", params:`You need help?`}],
            on: {            
              SPEAK_COMPLETE: "#DM.MeetingTitle"
              },
          },
        },
      },    
      /* Repeat the Info of the Meeting */
      MeetingInfo: {
        initial: "adamInfo",
        states: {
            adamInfo: {
            entry: [{type: "say", params: ({context}) => `The meeting is on ${context.weekdate} and the meeting title is ${context.meeting_name} `}],
            on: {            
              SPEAK_COMPLETE: "#DM.Done"
              },
          },
        },
      },

      /* Who is Adam Lambert */
      //Answer e.g. Adam Lambert is 42 years old
      WhoisAdam: {
        initial: "whoisAdam",
        states: {
          whoisAdam: {
            entry: [{type: "say", params:`How old is Adam Lambert?`}],
            on: {            
              SPEAK_COMPLETE: "Ask"
            },
          },
          Ask: {
            entry: "listen",
              on: { 
                RECOGNISED: 
                  [
                  {
                    //e.g. Adam Lambert is 42 years old
                    guard: ({ event }) => event.nluValue.entities[0].text == "42 years old",
                    actions: [
                      ({ context, event }) => { context.age = event.nluValue.entities[0].text},
                    ],
                    target: "#DM.WhatAdamBirth",    
                  },
                  {
                    guard: ({ event }) => event.nluValue.topIntent == "help" ,
                    target: "#DM.HelpWho",
                  },
                  "#DM.NotWhoGrammar"
                  ],
                ASR_NOINPUT:[{
                  guard: ({context}) => context.count >= 3,
                  target: "#DM.Done",
                },
                {
                  guard: ({context}) => context.count < 3,
                  actions:({context}) => context.count++,
                  target: "#DM.NoAdamVoice",
                }], 
              },
          },
        },
      },
      /* Not received voice */
      NoAdamVoice: {
        initial: "Novoice",
        states: {
          Novoice: {
            entry: [{type: "say", params:`I didn’t hear you`}],
            on: {            
              SPEAK_COMPLETE: "#DM.WhoisAdam"
              },
          },
        },
      },    
      /* Not in grammar */
      NotWhoGrammar: {
        initial: "notWhoGrammar",
        states: {
          notWhoGrammar: {
            entry: [{type: "say", params:`Sorry, I didn't understand. What's your question?, please say Adam Lambert is 42 years old`}],
            on: { 
              SPEAK_COMPLETE: "#DM.WhoisAdam"
              },
          },
        },
      },
     /* help */
     HelpWho: {
        initial: "helpWho",
        states: {
          helpWho: {
            entry: [{type: "say", params:`You need help?`}],
            on: {            
              SPEAK_COMPLETE: "#DM.WhoisAdam"
              },
          },
        },
      },          
      /* When is Adam Lambert's birthday */
      //Answer e.g. Adam Lambert is born in Jan 29th
      WhatAdamBirth: {
        initial: "whatAdamBirth",
        states: {
            whatAdamBirth: {
            entry: [{type: "say", params:`When is Adam Lambert's birthday?`}],
            on: {            
              SPEAK_COMPLETE: "Ask"
            },
          },
          Ask: {
            entry: "listen",
              on: { 
                RECOGNISED: 
                  [
                  {
                    //e.g. Adam Lambert is born in Jan 29th
                    guard: ({ event }) => event.nluValue.entities[0].text == "Jan 29th",
                    actions: [
                      ({ context, event }) => { context.birthday = event.nluValue.entities[0].text},
                    ],
                    target: "#DM.AdamInfo",    
                  },
                  {
                    guard: ({ event }) => event.nluValue.topIntent == "help" ,
                    target: "#DM.HelpAdamBirthDay",
                  },
                  "#DM.NotAdamBirthDayGrammar"
                  ],
                ASR_NOINPUT:[{
                  guard: ({context}) => context.count >= 3,
                  target: "#DM.Done",
                },
                {
                  guard: ({context}) => context.count < 3,
                  actions:({context}) => context.count++,
                  target: "#DM.NoAdamBirthDayVoice",
                }], 
              },
          },
        },
      },      
      /* Not received voice */
      NoAdamBirthDayVoice: {
        initial: "Novoice",
        states: {
          Novoice: {
            entry: [{type: "say", params:`I didn’t hear you`}],
            on: {            
              SPEAK_COMPLETE: "#DM.WhatAdamBirth"
              },
          },
        },
      },    
      /* Not in grammar */
      NotAdamBirthDayGrammar: {
        initial: "notAdamBirthDayGrammar",
        states: {
          notAdamBirthDayGrammar: {
            entry: [{type: "say", params:`Sorry, I didn't understand. What's your question?, please say Adam Lambert is born in Jan 29th`}],
            on: { 
              SPEAK_COMPLETE: "#DM.WhatAdamBirth"
              },
          },
        },
      },
     /* help */
     HelpAdamBirthDay: {
        initial: "helpAdamBirthDay",
        states: {
          helpAdamBirthDay: {
            entry: [{type: "say", params:`You need help?`}],
            on: {            
              SPEAK_COMPLETE: "#DM.WhatAdamBirth"
              },
          },
        },
      },     
      /* Repeat the Info of the Person */
      AdamInfo: {
        initial: "adamInfo",
        states: {
            adamInfo: {
            entry: [{type: "say", params: ({context}) => `Adam Lambert is ${context.age} and his birthday is ${context.birthday} `}],
            on: {            
              SPEAK_COMPLETE: "#DM.Done"
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
  