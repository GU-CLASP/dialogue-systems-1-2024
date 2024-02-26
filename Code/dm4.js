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

function checkIfYes(event) {
  return (event === "yes");    //the entity needs to be in the group yes
}

function checkIfNo(event) {
  return (event === "no");    //the entity needs to be in the group no
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
    meeting_name: "",
    DateTime: "",
    meeting_title: "",
    celebrity: "",
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
            {guard: ({event}) => checkIfMeetingIntent(event.nluValue.topIntent), //checking which path to take, creating a meeting
            target: "MeetingPersonSpeak"},
            {guard: ({event}) => checkIfWhoIsIntent(event.nluValue.topIntent),    //or celeb info
            actions: assign({celebrity: ({event}) => event.nluValue.entities[0].text}),
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
          actions: assign({meeting_name: ({event}) => event.nluValue.entities[0].text}),   
          target: "MeetingDateTimeSpeak" },
    
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
    
    MeetingDateTimeSpeak: {
      entry: [{ type: "speakToTheUser", 
              params: `On which day and at what time is your meeting?`}],
      on: { 
          SPEAK_COMPLETE : "MeetingDateTimeListen"
           },
          },
    
    MeetingDateTimeListen: {
      entry: "listenForUsersAnswer",
        on: {
          RECOGNISED : { 
            actions: assign({DateTime: ({event}) => event.nluValue.entities[0].text}),
            target: "MeetingTitleYesOrNoSpeak" },
          ASR_NOINPUT : {
              target: "ReRaiseMeetingDateTime"
                },
              },
            },
    
    ReRaiseMeetingDateTime: {
      entry: [{ type: "speakToTheUser", 
            params: `I didn't hear you.`}],
      on: {
          SPEAK_COMPLETE: "MeetingDateTimeSpeak"
              }
            },
  
    MeetingTitleYesOrNoSpeak: {
      entry: [{ type: "speakToTheUser",
    params: `Would you like to name your meeting?` }],
    on:  {
      SPEAK_COMPLETE: "MeetingTitleYesOrNoListen"
    }
    },
    
    MeetingTitleYesOrNoListen: {
      entry: "listenForUsersAnswer",
      on: {
        RECOGNISED: {guard: ({event}) => checkIfYes(event.nluValue.entities[0].category),
                    target: "MeetingTitleSpeak"},
                    target: "VerificationSpeak",
      }
    },

    MeetingTitleSpeak: {
      entry: [{ type: "speakToTheUser", 
      params: `Please name your meeting.`}],
      on: {
        SPEAK_COMPLETE: "MeetingTitleListen"
      }

    },

    MeetingTitleListen: {
      entry: "listenForUsersAnswer",
      on: {
        RECOGNISED: {
          actions: assign({meeting_title: ({event}) => event.nluValue.entities[0].text}),
          target: "VerificationWithTitleSpeak"
        }
      }
    },

    VerificationWithTitleSpeak: {
      entry: [{type: "speakToTheUser", params: ({ context}) => `Do you want me to create an appointment with the title of 
      ${context.meeting_title} with ${context.meeting_name} on ${context.DateTime}?`}],
      on: {
        SPEAK_COMPLETE: "VerificationWithTitleListen"
      }
    },

    VerificationWithTitleListen: {
      entry: "listenForUsersAnswer",
      on: { 
        RECOGNISED : [{ guard: ({event}) => checkIfYes(event.nluValue.entities[0].category), target: "Done" },
                        { guard: ({event}) => checkIfNo(event.nluValue.entities[0].category), target: "MeetingPersonSpeak" }],
        ASR_NOINPUT : "ReRaiseVerificationWithTitleSpeak"
        },
      },

    ReRaiseVerificationWithTitleSpeak: {
      entry: [{ type: "speakToTheUser", 
          params: `I didn't hear you.`,
            }],
          on: {
            SPEAK_COMPLETE: "VerificationWithTitleSpeak"
          }
        },
    
    VerificationSpeak: {
          entry: [{ type: "speakToTheUser", 
          params: ({ context }) => `Do you want me to create an appointment 
          with ${context.meeting_name} on ${context.DateTime}?`,
              }],
          on: { 
            SPEAK_COMPLETE: "VerificationListen",
            ASR_NOINPUT: "ReRaiseVerificationSpeak"
        },
      },
    
    VerificationListen: {
        entry: "listenForUsersAnswer",
        on: { 
          RECOGNISED : [{ guard: ({event}) => checkIfYes(event.nluValue.entities[0].category), target: "Done" },
                          { guard: ({event}) => checkIfNo(event.nluValue.entities[0].category), target: "MeetingPersonSpeak" }],
          ASR_NOINPUT : "ReRaiseVerificationSpeak"
          },
        },
    
    ReRaiseVerificationSpeak: {
          entry: [{ type: "speakToTheUser", 
          params: `I didn't hear you.`,
            }],
          on: {
            SPEAK_COMPLETE: "VerificationSpeak"
          }
        },

    StartTellingAboutACelebrity: {
        entry: [{type: "speakToTheUser", params: `Here is some information about that person.`}],
        on: {
          SPEAK_COMPLETE: "CelebrityInformationSpeak",
        }
      },

    CelebrityInformationSpeak: {
      entry: [{ type: "speakToTheUser", params: ({context}) => `${context.celebrity}`}],
      on: {
        SPEAK_COMPLETE: "Done"
      }
    },

    Done: {
      entry: [{ type: "speakToTheUser", params: `Done!`}],
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