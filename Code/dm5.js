import { and, assign, createActor, or, setup } from "xstate";
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
  "beyoncé" : {information : "Beyoncé Giselle Knowles-Carter, born September 4, 1981, is an American singer, songwriter and businesswoman. Dubbed as 'Queen Bey' and a prominent cultural figure of the 21st century, she has been recognized for her artistry and performances, with Rolling Stone naming her one of the greatest vocalists of all time."},
  "britney spears" : {information: "Britney Jean Spears, born December 2, 1981, is an American singer, often referred to as the 'Princess of Pop'. Spears has sold over 150 million records worldwide, making her one of the world's best-selling music artists."},
  "loreen" : {information: "Lorine Zineb Nora Talhaoui, born 16 October 1983, known professionally as Loreen, is a Swedish singer and songwriter. Representing Sweden, she has won the Eurovision Song Contest twice, in 2012 and 2023, with the songs 'Euphoria' and 'Tattoo'."},
  "angélique kidjo" : {information: "Angélique Kpasseloko Hinto Hounsinou Kandjo Manta Zogbin Kidjo, born July 14, 1960, is a Beninese-French singer-songwriter, actress and activist noted for her diverse musical influences and creative music videos. Angélique Kidjo has won five Grammy Awards."},
  "lady gaga" : {information: "Stefani Joanne Angelina Germanotta, born March 28, 1986, known professionally as Lady Gaga, is an American singer, songwriter and actress."},
  "ulf kristersson" : {information: "Ulf Hjalmar Kristersson, born 29 December 1963, is a Swedish politician who has been serving as Prime Minister of Sweden since 2022."},
  "brad pitt": {information: "William Bradley Pitt, born December 18, 1963, is an American actor and film producer. He is the recipient of various accolades, including two Academy Awards, two British Academy Film Awards, two Golden Globe Awards, and a Primetime Emmy Award. "},
  "barack obama" : {information: "Barack Hussein Obama II, born August 4, 1961, is an American politician who served as the 44th president of the United States from 2009 to 2017. A member of the Democratic Party, he was the first African-American president in U.S. history."},
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

function checkIfHelp(event) {   //checking if user needs help
    return (event === "help");
}

function checkThreshold(event) {
   return (event > 0.90);
}

function randomRepeat(myArray) {
  const randomIndex = Math.floor(Math.random()*myArray.length);
  return myArray[randomIndex]
}

function checkNumberOfRepetitions(repetition) {
  return (repetition ===3 );
  }


const repetitionphrases = ["Sorry, I didn't catch that.", "Sorry, can you please repeat that?", "I beg your pardon?", "Didn't quite understand. Could you please repeat?"]

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
      }),

    increaseRepetitions : ({ context }) => {context.repetition = context.repetition+1;}
    },

    setRepetitionBackToZero : ({ context }) => {context.repetition = 0;}    //probably there is a better way of doing this? for in case the user needs help at multiple states of the machine

  }).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBECyA6ACgJzABwENcBiAQQGUAlAFWvIH1KBRU5ATQG0AGAXUVDwB7WAEsALiMEA7fiAAeiAExcu6AJwA2RQFYuADgAsergEYuagOwAaEAE9EJkxfQaVp41wsaTAZl8Bffxs0dAB1AnFqQXIxIjFiAGEAGQBJBIBpbj4kECFRCWlZBQQTTXVdFQNFEwMfHz1FG3sEbQaXCu8fAy1tesDgjBxBAFs8MVIpCFJYAGssbBGx4nJMFnT6BIB5VEwkpmomLNk88UkZHOLtDR90Cx03PwsfCwM1JsQNVvQDB6cGrsc-RAISGo3Gk2mcySIlgYjAUmIzC2AHEAHIpchMZBHHInArnUDFPROdCKZ4VEwaPTPEx6d4tV7oDxcXpGLwaCwmIEghZgiZTWboaGw+HLVakdZbHZ7A44gTCU6FC4OLyktyONR6O53NQGekGXwuB4WE1cV7PbkYZDSMCJVIZOW5BX4ooqjRqlQarWKHV6uyIXqKcqVK6KNT6M2BIIgKSCCBwWRoY7Os6uhAAWg09Mzlvm+CIYGT+VTyoQVXpxPQPnVPk0pS4rgsufCkWisWwYiLioJ8gD1n9LTaFgq1LUai6Y58udBY35kK7LtLij07sUilelh6Bm0a6zA+6QYqXFrO+0XjM2mnvNnEMFM87uJTSsJiDqBlJ67HXh02939Ou2joGYKgmlqag7rqV6LOCApQjCcI9niJYvggXjvkepj6Bydz-roQEVF0dRoSYii5taUiFo+xbPr2LSNPupSktS9R6A0JjaKUZ5Rv4QA */
  context: {
    meeting_name: "",
    DateTime: "",
    meeting_title: "",
    celebrity: "",
    repetition : 0,
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
      entry: [{ type: "speakToTheUser", params: `How can I help you today? In case you need help, say help.`}],
      on: {
        SPEAK_COMPLETE: "Listen",
      },
    },
    
    Listen: {
      entry: "listenForUsersAnswer",
        on: {
          RECOGNISED: [
            //to check if the user wants help:
            {guard: ({event}) => checkIfHelp(event.nluValue.topIntent), target: "HelpTransitionToPrompt"},

            //to check if the machine is very unsure about the intent of the user (in general?) in case the user asks to do something completely random:
            //{guard: ({ event }) => checkThreshold(event.nluValue.intents[0].confidenceScore) === false, actions: [{type : "speakToTheUser", params: `I'm not sure what to do now, so I'm starting over.`}], 
            //target: "HelpTransitionToPrompt"},
            
            //to check if the top user's top intent is creating a meeting AND the machine is confident about this:
            {guard: ({event}) => checkIfMeetingIntent(event.nluValue.topIntent) && checkThreshold(event.nluValue.intents[0].confidenceScore), actions: "setRepetitionBackToZero",
            target: "MeetingPersonSpeak"},

            //WHY DOES THIS NOT WORK????? --> to check if the top user's top intent is creating a meeting AND the machine is NOT very confident about this (doesn't surpass the confidence threshold):
            {guard: ({event}) => checkIfMeetingIntent(event.nluValue.topIntent) === true && checkThreshold(event.nluValue.intents[0].confidenceScore) === false, actions: "setRepetitionBackToZero",
            target: "VerifyTheTopIntentIsMeetingSpeak"},

            //to check if the user's top intent is getting celebrity info AND the machine is confident about this:
            {guard: and([({event}) => checkIfWhoIsIntent(event.nluValue.topIntent), ({event}) => checkThreshold(event.nluValue.intents[0].confidenceScore)]),    
            actions: [assign({celebrity: ({event}) => event.nluValue.entities[0].text}), "setRepetitionBackToZero"], //assigning the celebrity in the context
            target: "StartTellingAboutACelebrity"},

            //This one works now --> to check if the user's top intent is getting celebrity info AND the machine is NOT very confident about this (doesn't surpass the confidence threshold):
            {guard: ({event}) => checkIfWhoIsIntent(event.nluValue.topIntent) === true && checkThreshold(event.nluValue.intents[0].confidenceScore) === false,    
            actions: [assign({celebrity: ({event}) => event.nluValue.entities[0].text}), "setRepetitionBackToZero"], //assigning the celebrity in the context
            target: "VerifyTheTopIntentIsCelebritySpeak"},
            ],

          ASR_NOINPUT: [
            {guard: ({ context }) => context.repetition < 3, target: "ReRaisePrompt"}, 
            {guard: ({ context }) => context.repetition === 3, actions: [{ type: "speakToTheUser", params: `Dear user, I think we are done here.`}], target: "Done"}]
        },
      },

    VerifyTheTopIntentIsMeetingSpeak: {
      entry: [{ type: "speakToTheUser", params: `You want me to create a meeting, is that right?`}],
      on : {
        SPEAK_COMPLETE: "VerifyTheTopIntentIsMeetingSpeak"
      }
    },

    VerifyTheTopIntentIsMeetingSpeak: {
      entry: "listenForUsersAnswer",
      on: {
        RECOGNISED: [
          {guard: ({ event }) => checkIfYes(event.nluValue.entities[0].category), target: "MeetingPersonSpeak"},
          {guard: ({ event }) => checkIfNo(event.nluValue.entities[0].category), target: "Prompt"}],
      }
    },

    VerifyTheTopIntentIsCelebritySpeak: {
      entry: [{ type: "speakToTheUser", params: `You want me to tell something about that celebrity, is that right?`}],
      on : {
        SPEAK_COMPLETE: "VerifyTheTopIntentIsCelebrityListen"
      }
    },

    VerifyTheTopIntentIsCelebrityListen: {
      entry: "listenForUsersAnswer",
      on: {
        RECOGNISED: [
          {guard: ({ event }) => checkIfYes(event.nluValue.entities[0].category), target: "StartTellingAboutACelebrity"},
          {guard: ({ event }) => checkIfNo(event.nluValue.entities[0].category), target: "Prompt"}],
      }
    },

    HelpTransitionToPrompt: {
      entry: [{type: "speakToTheUser", params: `I'm helping you by going back to the previous step.`}],
      on: {
        SPEAK_COMPLETE: "Prompt"}
    },

    ReRaisePrompt: {
      entry: [{type: "speakToTheUser", params: randomRepeat(repetitionphrases)}],
      on: { 
        SPEAK_COMPLETE: {
        actions: "increaseRepetitions", 
        target: "Prompt"}
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
        RECOGNISED : [
          {guard: ({event}) => checkIfHelp(event.nluValue.topIntent), target: "HelpTransitionToMeetingPerson"},
          {guard: ({event}) => event.nluValue.entities.length !== 0, actions: [assign({meeting_name: ({event}) => event.nluValue.entities[0].text}), "setRepetitionBackToZero"],   
          target: "MeetingDateTimeSpeak" },
          {guard: ({event}) => event.nluValue.entities.length === 0, actions: [{type: "speakToTheUser", params: `I cannot create a meeting with this person, sorry.`, target: "Done"}]},
        ],
    
        ASR_NOINPUT : [
            {guard: ({ context }) => context.repetition < 3, target: "ReRaiseMeetingPerson"}, 
            {guard: ({ context }) => context.repetition === 3, actions: [{ type: "speakToTheUser", params: `Dear user, I think we are done here.`}], target: "Done"}]
        },
      },

    HelpTransitionToMeetingPerson: {
      entry: [{type: "speakToTheUser", params: `I'm helping you by going back to the previous step.`}],
      on: {
        SPEAK_COMPLETE: "MeetingPersonSpeak"
      }
    },
    
    ReRaiseMeetingPerson: {
      entry: [{type: "speakToTheUser", params: randomRepeat(repetitionphrases)}],
      on: { 
        SPEAK_COMPLETE: {
        actions: "increaseRepetitions", 
        target: "MeetingPersonSpeak"}
    },
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
          RECOGNISED : [
            {guard: ({event}) => checkIfHelp(event.nluValue.topIntent), target: "HelpTransitionToMeetingDateTime"},
            {actions: [assign({DateTime: ({event}) => event.nluValue.entities[0].text}), "setRepetitionBackToZero"],
            target: "MeetingTitleYesOrNoSpeak"}],
          ASR_NOINPUT : [
            {guard: ({ context }) => context.repetition < 3, target: "ReRaiseMeetingDateTime"}, 
            {guard: ({ context }) => context.repetition === 3, actions: [{ type: "speakToTheUser", params: `Dear user, I think we are done here.`}], target: "Done"}
          ]
        },
      },

    HelpTransitionToMeetingDateTime: {
      entry: [{type: "speakToTheUser", params: `I'm helping you by going back the previous state.`}],
      on: {
        SPEAK_COMPLETE: "MeetingDateTimeSpeak"
      }
    },
    
    ReRaiseMeetingDateTime: {
      entry: [{ type: "speakToTheUser", 
            params: randomRepeat(repetitionphrases)}],
      on: {
          SPEAK_COMPLETE: {
            actions: "increaseRepetitions", 
            target: "MeetingDateTimeSpeak"}
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
        RECOGNISED: [
                    {guard: ({event}) => checkIfYes(event.nluValue.entities[0].category), actions: "setRepetitionBackToZero",
                    target: "MeetingTitleSpeak"},
                    {guard: ({event}) => checkIfNo(event.nluValue.entities[0].category), actions: "setRepetitionBackToZero", target: "VerificationSpeak"},
                    {guard: ({event}) => checkIfHelp(event.nluValue.topIntent), target: "HelpTransitionToMeetingTitleYesOrNo"},],
        ASR_NOINPUT: [
          {guard: ({ context }) => context.repetition < 3, target: "ReraiseMeetingTitleYesOrNo"}, 
          {guard: ({ context }) => context.repetition === 3, actions: [{ type: "speakToTheUser", params: `Dear user, I think we are done here.`}], target: "Done"}]
      }
    },

    HelpTransitionToMeetingTitleYesOrNo: {
      entry: [{type: "speakToTheUser", params: `I'm helping you by going back to the previous step.`}],
      on: {
        SPEAK_COMPLETE: "MeetingTitleYesOrNoSpeak"
      }
    },

    ReraiseMeetingTitleYesOrNo: {
      entry: [{ type: "speakToTheUser", params: randomRepeat(repetitionphrases)}],
      on: { SPEAK_COMPLETE: 
        {actions: "increaseRepetitions", target:"MeetingTitleYesOrNoSpeak"}
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
        RECOGNISED: [
          {guard: ({event}) => checkIfHelp(event.nluValue.topIntent), target: "HelpTransitionToMeetingTitle"},
          {guard: ({event}) => event.nluValue.entities.length !== 0, actions: [assign({meeting_title: ({event}) => event.nluValue.entities[0].text}), "setRepetitionBackToZero"],   
          target: "VerificationWithTitleSpeak" },
          {guard: ({event}) => event.nluValue.entities.length == 0, actions: [{type: "speakToTheUser", params: `I couldn't properly register the meeting title, sorry.`, target: "HelpTransitionToMeetingTitle"}]}],
        ASR_NOINPUT:  [
          {guard: ({ context }) => context.repetition < 3, target: "ReRaiseMeetingTitle"}, 
          {guard: ({ context }) => context.repetition === 3, actions: [{ type: "speakToTheUser", params: `Dear user, I think we are done here.`}], target: "Done"}]
      },
    },

    HelpTransitionToMeetingTitle: {
      entry: [{type: "speakToTheUser", params: `I'm helping you by going back to the previous step.`}],
      on: {
        SPEAK_COMPLETE: "MeetingTitleSpeak"
      }
    },

    ReRaiseMeetingTitle: {
      entry: [{ type: "speakToTheUser", 
    params: randomRepeat(repetitionphrases)}],
    on: {
      SPEAK_COMPLETE: {
        actions: "increaseRepetitions", 
        target: "MeetingTitleSpeak"}
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
        RECOGNISED : [
          { guard: ({event}) => checkIfYes(event.nluValue.entities[0].category), target: "Done" },
          { guard: ({event}) => checkIfNo(event.nluValue.entities[0].category), actions: "setRepetitionBackToZero", target: "MeetingPersonSpeak" },
          {guard: ({event}) => checkIfHelp(event.nluValue.topIntent), target: "HelpTransitionToVerificationWithTitle"},],
        ASR_NOINPUT : [
          {guard: ({ context }) => context.repetition < 3, target: "ReRaiseVerificationWithTitleSpeak"}, 
          {guard: ({ context }) => context.repetition === 3, actions: [{ type: "speakToTheUser", params: `Dear user, I think we are done here.`}], target: "Done"}]
        },
      },

      HelpTransitionToVerificationWithTitle: {
        entry: [{type: "speakToTheUser", params: `I'm helping you by going back to the previous step.`}],
        on: {
          SPEAK_COMPLETE: "VerificationWithTitleSpeak"
        }
      },

    ReRaiseVerificationWithTitleSpeak: {
      entry: [{ type: "speakToTheUser", 
          params: randomRepeat(repetitionphrases),
            }],
          on: {
            SPEAK_COMPLETE: {
              actions: "increaseRepetitions", 
              target: "VerificationWithTitleSpeak"}
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
          RECOGNISED : [
            { guard: ({event}) => checkIfYes(event.nluValue.entities[0].category), target: "Done" },
            { guard: ({event}) => checkIfNo(event.nluValue.entities[0].category), actions: "setRepetitionBackToZero", target: "MeetingPersonSpeak" },
            {guard: ({event}) => checkIfHelp(event.nluValue.topIntent), target: "HelpTransitionToVerification"}],
          ASR_NOINPUT : [
            {guard: ({ context }) => context.repetition < 3, target: "ReRaiseVerificationSpeak"}, 
            {guard: ({ context }) => context.repetition === 3, actions: [{ type: "speakToTheUser", params: `Dear user, I think we are done here.`}], target: "Done"}]
          },
        },

    HelpTransitionToVerification: {
      entry: [{type: "speakToTheUser", params: `I'm helping you by going back to the previous step.`}],
      on: {
        SPEAK_COMPLETE: "VerificationSpeak"
      }
    },
    
    ReRaiseVerificationSpeak: {
          entry: [{ type: "speakToTheUser", 
          params: randomRepeat(repetitionphrases),
            }],
          on: {
            SPEAK_COMPLETE: {
              actions: "increaseRepetitions", 
              target: "VerificationSpeak"}
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
            target: "Done"},
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