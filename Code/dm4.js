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

const celebrityDatabase = {
  "käärijä" : {information : "Jere Pöyhönen, born 21 October 1993, known professionally as Käärijä, is a Finnish rapper, singer and songwriter. He represented Finland in the Eurovision Song Contest 2023 with the song 'Cha Cha Cha', placing second with 526 points and finishing first in the public vote."},
  "beyoncé" : {information : "Beyoncé Giselle Knowles-Carter, born September 4, 1981, is an American singer, songwriter and businesswoman. Dubbed as 'Queen Bey' and a prominent cultural figure of the 21st century, she has been recognized for her artistry and performances, with Rolling Stone naming her one of the greatest vocalists of all time."},
  "alexander stubb" : {information: "Cai-Göran Alexander Stubb, born 1 April 1968, is a Finnish politician who is the president-elect of Finland, having won the 2024 presidential election. He previously served as Prime Minister of Finland from 2014 to 2015."},
  "britney spears" : {information: "Britney Jean Spears, born December 2, 1981, is an American singer, often referred to as the 'Princess of Pop'. Spears has sold over 150 million records worldwide, making her one of the world's best-selling music artists."},
  "loreen" : {information: "Lorine Zineb Nora Talhaoui, born 16 October 1983, known professionally as Loreen, is a Swedish singer and songwriter. Representing Sweden, she has won the Eurovision Song Contest twice, in 2012 and 2023, with the songs 'Euphoria' and 'Tattoo'."},
  "angélique kidjo" : {information: "Angélique Kpasseloko Hinto Hounsinou Kandjo Manta Zogbin Kidjo, born July 14, 1960, is a Beninese-French singer-songwriter, actress and activist noted for her diverse musical influences and creative music videos. Angélique Kidjo has won five Grammy Awards."},
  "lady gaga" : {information: "Stefani Joanne Angelina Germanotta, born March 28, 1986, known professionally as Lady Gaga, is an American singer, songwriter and actress."},
  "ulf kristersson" : {information: "Ulf Hjalmar Kristersson, born 29 December 1963, is a Swedish politician who has been serving as Prime Minister of Sweden since 2022."},
  "brad pitt": {information: "William Bradley Pitt, born December 18, 1963, is an American actor and film producer. He is the recipient of various accolades, including two Academy Awards, two British Academy Film Awards, two Golden Globe Awards, and a Primetime Emmy Award. "},
  "barack obama" : {information: "Barack Hussein Obama II, born August 4, 1961, is an American politician who served as the 44th president of the United States from 2009 to 2017. A member of the Democratic Party, he was the first African-American president in U.S. history."},
  "sauli niinistö" : {information: "Sauli Väinämö Niinistö,born 24 August 1948,is a Finnish politician who has been the 12th president of Finland since 1 March 2012."},
  "Carl Gustaf XVI" : {information: "Carl XVI Gustaf, Carl Gustaf Folke Hubertus,born 30 April 1946, is King of Sweden."},
};

/* Helper functions */
function isInCelebrityDatabase(utterance) {
  return utterance.toLowerCase() in celebrityDatabase;
}

function getCelebrityInfo(utterance) {
  return (celebrityDatabase[utterance.toLowerCase()] || {}).information;
}

function checkIfMeetingIntent(event) {   //for checking the intent
  return (event === "CreateMeeting");
}
function checkIfWhoIsIntent(event){       //for checking the intent
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
      on: {
        SPEAK_COMPLETE: "Listen",
      },
    },
    
    Listen: {
      entry: "listenForUsersAnswer",
        on: {
          RECOGNISED: [
            {guard: ({event}) => checkIfMeetingIntent(event.nluValue.topIntent), //checking which path to take, creating a meeting
            target: "MeetingPersonSpeak"},
            {guard: ({event}) => checkIfWhoIsIntent(event.nluValue.topIntent),    //or celeb info
            actions: assign({celebrity: ({event}) => event.nluValue.entities[0].text}), //assigning the celebrity in the context
            target: "StartTellingAboutACelebrity"}],
          ASR_NOINPUT: "ReRaisePrompt"
        },
      },

    ReRaisePrompt: {
      entry: [{type: "speakToTheUser", params: `Are you there?`}],
      on: { SPEAK_COMPLETE: 
        "Prompt"}
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
        RECOGNISED: [{guard: ({event}) => checkIfYes(event.nluValue.entities[0].category),
                    target: "MeetingTitleSpeak"},
                    {guard: ({event}) => checkIfNo(event.nluValue.entities[0].category), target: "VerificationSpeak"}],
        ASR_NOINPUT: "ReraiseMeetingTitleYesOrNo"
      }
    },

    ReraiseMeetingTitleYesOrNo: {
      entry: [{ type: "speakToTheUser", params: `Sorry, I didn't catch that.`}],
      on: { SPEAK_COMPLETE: "MeetingTitleYesOrNoSpeak"}
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
        },
        ASR_NOINPUT: "ReRaiseMeetingTitle"
      }
    },

    ReRaiseMeetingTitle: {
      entry: [{ type: "speakToTheUser", 
    params: `Sorry, didn't hear you.`}],
    on: {
      SPEAK_COMPLETE: "MeetingTitleSpeak"
    }
  },


    VerificationWithTitleSpeak: {
      entry: [{type: "speakToTheUser", params: ({ context}) => `Do you want me to create a 
      ${context.meeting_title} with ${context.meeting_name} ${context.DateTime}?`}],
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
        entry: [{ type: "speakToTheUser", params: `I'm checking to see if I have information about that person.` }],
        on: { 
          SPEAK_COMPLETE: [
          {guard: ({ context }) => isInCelebrityDatabase(context.celebrity),
            target: "CelebrityInformationSpeak"},
          {guard: ({ context }) => isInCelebrityDatabase(context.celebrity) === false,
            actions: [{type: "speakToTheUser",
            params: `I'm sorry. I don't have any information of that particular person.`}],
            target: "Done"}
          ],
        },
      },
        

    CelebrityInformationSpeak: {
      entry: [{ type: "speakToTheUser", params: ({context}) => `${getCelebrityInfo(context.celebrity)}`}],
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