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
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
};

/* Helper functions */
function isInGrammar(utterance) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}

const dmMachine = setup({
  actions: {
    listenForUsersAnswer : ({ context }) => 
    context.ssRef.send({
       type: "LISTEN" }),

    speakToTheUser : ({ context }, params) => 
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
    meeting_dur: '',
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
      params: `Who would you like to meet?`,
          }],
      on: {
      SPEAK_COMPLETE : "MeetingPersonListen",
      },
    },

    MeetingPersonListen: {
      entry: "listenForUsersAnswer",
      on: {
        RECOGNISED : { 
          actions: assign({meeting_name: ({context, event}) => event.value[0].utterance}),
          target: "MeetingDaySpeak"
      },
        ASR_NOINPUT : {
          actions: [{ type: "speakToTheUser", 
        params: `I didn't hear you.` }],
        target: "MeetingPersonSpeak",
        },
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
        RECOGNISED : { 
            actions: assign({meeting_date: ({context, event}) => event.value[0].utterance}),
            target: "MeetingDurSpeak"
            },
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
      on: { SPEAK_COMPLETE: "MeetingDurListen"
     },
    },

    MeetingDurListen: {
      entry: "listenForUsersAnswer",
      on: {
        RECOGNISED : { 
          actions: assign({meeting_dur: ({context, event}) => event.value[0].utterance}),
          target: "MeetingTimeSpeak"
            },
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
        RECOGNISED : { 
          actions: assign({meeting_time: ({context, event}) => event.value[0].utterance}),
          target: "Verification"
          },
        ASR_NOINPUT : {
          actions: [{ type: "speakToTheUser", 
          params: `I didn't hear you.` }],
          target: "MeetingTimeSpeak",
          },
        },
      },

    Verification: {
      entry: [{ type: "speakToTheUser", 
      params: `Do you want me to create an appointment 
      with ${context.meeting_name} on ${context.meeting_date} 
      at ${context.meeting_time}?`,
          }],
      on: { SPEAK_COMPLETE: "#DM.Done" 
    },
  },

    Done: {
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
