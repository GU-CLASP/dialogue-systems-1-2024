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
const grammar = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  rasmus: { person: "Rasmus Blanck" },
  eleni: {person: "Eleni Fysikoudi"},
  victoria: {person: "Victoria Danilidou"},
  pewdiepie: { person: "Felix Arvid Ulf Kjellberg" },
  king: { person: "Carl XVI Gustaf"},
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  wednesday: { day: "Wednesday"},
  thursday: {day: "Thursday"},
  friday: {day: "Friday"},
  saturday: {day: "Saturday"},
  sunday: {day: "Sunday"},
  "8": { time: "08:00" },
  "8,15": {time: "08:15"},
  "9": { time: "09:00" },
  "9,30": { time: "9:30"},
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  "13": { time: "13:00" },
  "14": { time: "14:00" },
  "15": { time: "15:00" },
  "16": { time: "16:00" },
  agree: ["yes","yup","of course","yeah", "yes please"],
  disagree: ["no","nope","nah", "no thanks"]
};

/* Helper functions */
function isInGrammar(utterance) {
  return (utterance.toLowerCase() in grammar);
}

function isTheAnswerYes(utterance) {
  return (grammar.agree.includes(utterance.toLowerCase()));
}

function isTheAnswerNo(utterance) {
  return (grammar.disagree.includes(utterance.toLowerCase()));
}

function getPerson(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).person; //returns the value of the value 
}

function getDay(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).day; //returns the value of the value 

}  

function getTime(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).time; //returns the value of the value 
}


const dmMachine = setup({
  actions: {
    listenForUsersAnswer : ({ context }) => 
    context.ssRef.send({
       type: "LISTEN" }),

    speakToTheUser : ({ context}, params) => 
    context.ssRef.send({
       type: "SPEAK",
      value: {
        utterance: params
      },
    }),

    assignMeetingName : assign({meeting_name: ({context, event}) => event.value[0].utterance})

}}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBECyA6ACgJzABwENcBiAQQGUAlAFWvIH1KBRU5ATQG0AGAXUVDwB7WAEsALiMEA7fiAAeiAIwBOAOwAaEAE8li1egCsAXyOa06AOoFx1QeTFExxAMIAZAJLOA0tz5IQQqIS0rIKCCpc6ABMBpo6CAYAHAAs0camIOY4ggC2eGKkUhCksADWWNi5+cTkmCxe9M4A8qiYrkzUTL6ygeKSMv5hyar6qrHaiABsk4roitMLiwsmZhjZeQVFJeXbxMzNAOIAcu7kTMjd-r3BA6Bh04mGkzFxiAYGiiuZa5UbhcVldC7Wr1RotNodLq8HrCPohQZKSbJV4IZKKZJfczIaRgFwebyXASwm6hRHIiYJADMlPQYxMGSkgggcFkaBhQX6pIQAFpJijeZifvgiGB2XDbvJEMkoijErN0qtLNYxLZ7I4xSSEQkNBSkqk6Rksr98v9thrOVqoqp9eN4slJjTkspncoopTVFxJlwDMNBRUqpsAeV1vlzfC7ohKVEorTbVNKY95ktk36Q4HtkCymGJfdJgZ0JSDMp3XGEHmaTE-dipKKrsSLRGEjKKdLIlxEtTO13qfSjEA */
  context: {
    meeting_name: '',
    meeting_date: '',
    meeting_time: '',
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
        CLICK: "MeetingPersonSpeak",
      },
      after: {
        10000: { target: "MeetingPersonSpeak"}
      },
    },

    MeetingPersonSpeak: {
      entry: [{ type: "speakToTheUser", 
      params: `Let's create an appointment! Who would you like to meet?`,
          }],
      on: {
      SPEAK_COMPLETE : "MeetingPersonListen",
      },
    },

    MeetingPersonListen: {
      entry: "listenForUsersAnswer",
      on: {
        RECOGNISED : [{ 
          guard: ({event}) => isInGrammar(event.value[0].utterance) === true, 
          actions: assign({meeting_name: ({context, event}) => event.value[0].utterance}),
          target: "MeetingDaySpeak" },
          {
          actions: [{ type: "speakToTheUser", params: `I'm sorry, this person is not in my grammar. Please re-check my grammar.` }],
          target: "WaitToStart"}],

        ASR_NOINPUT : {
          actions: [{ type: "speakToTheUser", 
        params: `I didn't hear you.` }],
        target: "MeetingPersonSpeak" }
        },
    },

    MeetingDaySpeak: {
      entry: [{ type: "speakToTheUser", 
          params: `On which day is your meeting?`,
              }],
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
          {
          actions: [{ type: "speakToTheUser", params: `I'm sorry, this date is not in my grammar. Please re-check my grammar.` }],
          target: "WaitToStart"}],
        ASR_NOINPUT : {
            actions: [{ type: "speakToTheUser", 
            params: `I didn't hear you.` }],
            target: "MeetingDaySpeak",
            },
          },
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
                        { guard: ({event}) => isTheAnswerNo(event.value[0].utterance) === true, target: "MeetingTimeSpeak" },
                    ],
        ASR_NOINPUT : {
          actions: [{ type: "speakToTheUser", 
          params: `I didn't hear you.` }],
          target: "MeetingDurSpeak",
            },
        },
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
          actions: [{ type: "speakToTheUser", 
          params: `I didn't hear you.` }],
          target: "MeetingTimeSpeak",
          },
        },
      },

    VerificationNotWholeDaySpeak: {
      entry: [{ type: "speakToTheUser", 
      params: ({ context }) => `Do you want me to create an appointment 
      with ${getPerson(context.meeting_name)} on ${getDay(context.meeting_date)} 
      at ${getTime(context.meeting_time)}?`,
          }],
      on: { SPEAK_COMPLETE: "VerificationNotWholeDayListen" 
    },
  },

  VerificationNotWholeDayListen: {
    entry: "listenForUsersAnswer",
    on: { 
      RECOGNISED : [{ guard: ({event}) => isTheAnswerYes(event.value[0].utterance) === true, target: "#DM.Done" },
                      { guard: ({event}) => isTheAnswerNo(event.value[0].utterance) === true, target: "MeetingPersonSpeak" }],
      },
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
      RECOGNISED : [{ guard: ({event}) => isTheAnswerYes(event.value[0].utterance) === true, target: "#DM.Done" },
                      { guard: ({event}) => isTheAnswerNo(event.value[0].utterance) === true, target: "MeetingPersonSpeak" }],
      },
  },

    Done: {
      entry: [{ type: "speakToTheUser", params: "Meeting created!"}],
      on: {
        CLICK: "MeetingPersonSpeak",
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
