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
        

//Defining our NLU intents, will we need these tho???
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

function checkIfMeetingIntent(event) {
  return (event === "CreateMeeting");
}
function checkIfWhoIsIntent(event){
  return (event === "WhoIsX");
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
        utterance: params}
      })
    }
  }).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBECyA6ACgJzABwENcBiAQQGUAlAFWvIH1KBRU5ATQG0AGAXUVDwB7WAEsALiMEA7fiAAeiAExcu6AJwA2RQFYuADgAsergEYuagOwAaEAE9EJkxfQaVp41wsaTAZl8Bffxs0dAB1AnFqQXIxIjFiAGEAGQBJBIBpbj4kECFRCWlZBQQTTXVdFQNFEwMfHz1FG3sEbQaXCu8fAy1tesDgjBxBAFs8MVIpCFJYAGssbBGx4nJMFnT6BIB5VEwkpmomLNk88UkZHOLtDR90Cx03PwsfCwM1JsQNVvQDB6cGrsc-RAISGo3Gk2mcySIlgYjAUmIzC2AHEAHIpchMZBHHInArnUDFPROdCKZ4VEwaPTPEx6d4tV7oDxcXpGLwaCwmIEghZgiZTWboaGw+HLVakdZbHZ7A44gTCU6FC4OLyktyONR6O53NQGekGXwuB4WE1cV7PbkYZDSMCJVIZOW5BX4ooqjRqlQarWKHV6uyIXqKcqVK6KNT6M2BIIgKSCCBwWRoY7Os6uhAAWg09Mzlvm+CIYGT+VTyoQVXpxPQPnVPk0pS4rgsufCkWisWwYiLioJ8gD1n9LTaFgq1LUai6Y58udBY35kK7LtLij07sUilelh6Bm0a6zA+6QYqXFrO+0XjM2mnvNnEMFM87uJTSsJiDqBlJ67HXh02939Ou2joGYKgmlqag7rqV6LOCApQjCcI9niJYvggXjvkepj6Bydz-roQEVF0dRoSYii5taUiFo+xbPr2LSNPupSktS9R6A0JjaKUZ5Rv4QA */
  context: {
    count: 0,
  },
  id: "DM",
  initial: "Prepare",
  states: {
    initial: "Prepare",
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
        CLICK: "Prompt",
      },
    },

    Prompt: {
      entry: [{ type: "speakToTheUser", params: `How can I help you today?`}],
        on: { SPEAK_COMPLETE: "Listen" },
        },

    Listen: {
      entry: "listenForUsersAnswer",
        on: {
          RECOGNISED: [
            {guard: ({event}) => checkIfMeetingIntent(event.nluValue.topIntent) === true,
            target: "MeetingPersonSpeak"},
            {guard: ({event}) => checkIfWhoIsIntent(event.nluValue.topIntent) === true,
            target: "StartTellingAboutACelebrity"}],
          },
        },

    MeetingPersonSpeak: {
      entry: [{ type: "speakToTheUser", 
        params: `Who would you like to meet?`}],
      on: {
        SPEAK_COMPLETE : "MeetingPersonListen",
          },
        },
    
    MeetingPersonListen: {
      entry: "listenForUsersAnswer",
      on: {
        RECOGNISED : { 
          actions: assign({meeting_name: ({context, event}) => event.nluValue.topEntity}),   //check from this point forward...
          target: "MeetingDaySpeak" },
    
        ASR_NOINPUT : {
          target: "ReRaiseMeetingPerson"
           },
          },
        },
    
    ReRaiseMeetingPerson: {
      entry: [{ type: "speakToTheUser", 
      params: `I didn't hear you.`}],
      on: {
        SPEAK_COMPLETE: "MeetingPersonSpeak"
          }
        },
    
    MeetingDaySpeak: {
      entry: [{ type: "speakToTheUser", 
              params: `On which day is your meeting?`}],
      on: { 
          SPEAK_COMPLETE : "MeetingDayListen"
           },
          },
    
    MeetingDayListen: {
      entry: "listenForUsersAnswer",
        on: {
          RECOGNISED : [{ 
            guard: ({event}) => isInGrammar(event.value[0].utterance) === true, 
            actions: assign({meeting_date: ({context, event}) => event.value[0].utterance}),
            target: "MeetingDurSpeak" },
              {actions: [{ type: "speakToTheUser", params: `I'm sorry, this date is not in my grammar. Please re-check my grammar.` }],
              target: "WaitToStart"}],
          ASR_NOINPUT : {
              target: "ReRaiseMeetingDay"
                },
              },
            },
    
    ReRaiseMeetingDay: {
      entry: [{ type: "speakToTheUser", 
            params: `I didn't hear you.`}],
      on: {
          SPEAK_COMPLETE: "MeetingDaySpeak"
              }
            },
    
    
    MeetingDurSpeak: {
          entry: [{ type: "speakToTheUser", 
          params: `Will it take the whole day?`,
              }],
          on: { SPEAK_COMPLETE : "MeetingDurListen"
         },
        },
    
    MeetingDurListen: {
          entry: "listenForUsersAnswer",
          on: { 
            RECOGNISED : [{ guard: ({event}) => isTheAnswerYes(event.value[0].utterance) === true, target: "VerificationWholeDaySpeak" },
                            { guard: ({event}) => isTheAnswerNo(event.value[0].utterance) === true, target: "MeetingTimeSpeak" }],
            ASR_NOINPUT : {
              target: "ReRaiseMeetingDur"
                },
            },
        },
    
    ReRaiseMeetingDur: {
          entry: [{ type: "speakToTheUser", 
          params: `I didn't hear you.`}],
          on: {
            SPEAK_COMPLETE: "MeetingDurSpeak"
          }
        },
    
    MeetingTimeSpeak: {
          entry: [{ type: "speakToTheUser", 
          params: `What time is your meeting?`,
              }],
          on: { SPEAK_COMPLETE: "MeetingTimeListen" 
        },
      },
    
    MeetingTimeListen: {
          entry: "listenForUsersAnswer",
          on: {
            RECOGNISED : [{ 
              guard: ({event}) => isInGrammar(event.value[0].utterance) === true, 
              actions: assign({meeting_time: ({context, event}) => event.value[0].utterance}),
              target: "VerificationNotWholeDaySpeak" },
              {
              actions: [{ type: "speakToTheUser", params: `I'm sorry, this time is not in my grammar. Please re-check my grammar.` }],
              target: "WaitToStart"}],
            ASR_NOINPUT : {
              target: "ReRaiseMeetingTime"
              },
            },
          },
    
    ReRaiseMeetingTime: {
            entry: [{ type: "speakToTheUser", 
            params: `I didn't hear you.`,
              }],
            on: {
              SPEAK_COMPLETE: "MeetingTimeSpeak"
            }
          },
    
    VerificationNotWholeDaySpeak: {
          entry: [{ type: "speakToTheUser", 
          params: ({ context }) => `Do you want me to create an appointment 
          with ${getPerson(context.meeting_name)} on ${getDay(context.meeting_date)} 
          at ${getTime(context.meeting_time)}?`,
              }],
          on: { 
            SPEAK_COMPLETE: "VerificationNotWholeDayListen",
        },
      },
    
    VerificationNotWholeDayListen: {
        entry: "listenForUsersAnswer",
        on: { 
          RECOGNISED : [{ guard: ({event}) => isTheAnswerYes(event.value[0].utterance) === true, target: "Done" },
                          { guard: ({event}) => isTheAnswerNo(event.value[0].utterance) === true, target: "MeetingPersonSpeak" }],
          ASR_NOINPUT : { target: "ReRaiseVerificationNotWholeDay" }
          },
        },
    
    ReRaiseVerificationNotWholeDay: {
          entry: [{ type: "speakToTheUser", 
          params: `I didn't hear you.`,
            }],
          on: {
            SPEAK_COMPLETE: "VerificationNotWholeDaySpeak"
          }
        },
    
    
    VerificationWholeDaySpeak: {
        entry: [{ type: "speakToTheUser", 
          params: ({ context }) => `Do you want me to create an appointment 
          with ${getPerson(context.meeting_name)} on ${getDay(context.meeting_date)} 
          for the whole day?`,
              }],
          on: { SPEAK_COMPLETE: "VerificationWholeDayListen" 
        },
      },
    
    VerificationWholeDayListen: {
        entry: "listenForUsersAnswer",
        on: { 
          RECOGNISED : [{ guard: ({event}) => isTheAnswerYes(event.value[0].utterance) === true, target: "Done" },
                          { guard: ({event}) => isTheAnswerNo(event.value[0].utterance) === true, target: "MeetingPersonSpeak" }],
          ASR_NOINPUT : {target: "ReRaiseVerificationWholeDay"}
          },
      },
    
    ReRaiseVerificationWholeDay: {
        entry: [{ type: "speakToTheUser", 
        params: `I didn't hear you.`,
          }],
        on: {
          SPEAK_COMPLETE: "VerificationWholeDaySpeak"
        }
      },

    StartTellingAboutACelebrity: {
        entry: [{type: "speakToTheUser"}]
      },

    Done: {
      on: {
        CLICK: "Prompt",
      },
    },
  },
})

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