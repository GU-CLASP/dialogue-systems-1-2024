import { assign, createActor, setup } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure.js";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint: "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const settings = {
  azureCredentials: azureCredentials,
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

const grammar = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  rasmus: { person: "Rasmus Blanck" },
  toby: { person: "Tobbe Tingvall" }, 
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  wednesday: {day: "Wednesday"},
  thursday: {day: "Thursday"},
  friday:{day: "Friday"},
  "9": {time: "09:00"},
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  agree: ["yes", "yeah", "yup","of course"],
  disagree: ["no", "nope"],
};

function isInGrammar(utterance) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}

function getResponse(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).response;
}

function getDay(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).day;
}

function getTime(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).time;
}

function isTheAnswerYes(utterance){
  return (grammar.agree.includes(utterance.toLowerCase()));
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
    listen: ({ context }) =>
      context.ssRef.send({
        type: "LISTEN",
      }),
    assignPerson: assign({
      person: (context, event) => getPerson(event.value[0].utterance),
    }),
    assignDay: assign({
      day: (context, event) => getDay(event.value[0].utterance),
    }),
    assignTime: assign({
      time: (context, event) => getTime(event.value[0].utterance),
    }),
    assignResponse: assign({
      response: (context, event)=> getResponse(event.value[0].utterance),
    }),
    confirmAppointment: "say",
  },
}).createMachine({
  context: {
    count: 0,
    person: "",
    day: "",
    time: "",
    response:"", 
    lastActivity: Date.now(), // This is to initialize the last activity timestamp
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
      on: { ASRTTS_READY: "PromptAndAsk" },
    },
    PromptAndAsk: {
      entry: ({ context }) =>
        context.ssRef.send({
          type: "SPEAK",
          value: {
            utterance: `Let's schedule a meeting?`,
          },
        }),
      on: { SPEAK_COMPLETE: "AskWithWhom" },
    },
    AskWithWhom: {
      entry: ({ context }) =>
        context.ssRef.send({
          type: "SPEAK",
          value: {
            utterance: `With whom would you want to have a meeting with?`,
          },
        }),
      on: { SPEAK_COMPLETE: "ListenWithWhom" },
    },
    ListenWithWhom: {
      entry: ({ context }) =>
        context.ssRef.send({
          type: "LISTEN",
        }),

      on: {
        RECOGNISED: [
          {
            guard: ({event}) => isInGrammar(event.value[0].utterance),
              target: "AskForDay",
              actions: assign({
                person: ({event}) => getPerson(event.value[0].utterance),
              } 
            )},
          {
            target: "AskForDay"
          },
        ],
      },
    },
    AskForDay: {
      entry: ({ context }) => {
        context.lastActivity = Date.now(); 
        context.ssRef.send({
          type: "SPEAK",
          value: {
            utterance: `Which day would you like to have the meeting?`,
          },
        });
      },
      on: { SPEAK_COMPLETE: "ListenForDay" },
    },
    ListenForDay: {
      entry: ({ context }) => {
        context.lastActivity = Date.now(); 
        context.ssRef.send({
          type: "LISTEN",
        });
      },
      on: {
        RECOGNISED: [
          {
            guard: ({ event }) => isInGrammar(event.value[0].utterance),
            target: "AskWholeDay",
            actions: assign({
              day: ({ event }) => getDay(event.value[0].utterance),
            }),
          },
          {
            //  transition back to AskWithWhom
            target: "AskWholeDay",
          },
        ],
      },
    },
    AskWholeDay: {
      entry: ({ context }) => {
        context.lastActivity = Date.now(); 
        context.ssRef.send({
          type: "SPEAK",
          value: {
            utterance: `Will the meeting take the whole day?`,
          },
        });
      },
      on: { SPEAK_COMPLETE: "ListenForResponse" },
    },
    ListenForResponse: {
      entry: ({ context }) => {
        context.lastActivity = Date.now(); 
        context.ssRef.send({
          type: "LISTEN",
        });
      },
      on: {
        RECOGNISED: [
          {
            guard: ({ event }) => isTheAnswerYes(event.value[0].utterance),
            target: "Confirmation",
          },
          {
            // transition to MeetingTime
            target: "MeetingTime",
          },
        ],
      },
    },
    MeetingTime: {
      entry: ({ context }) => {
        context.lastActivity = Date.now(); 
        context.ssRef.send({
          type: "SPEAK",
          value: {
            utterance: `What time would you like to schedule a meeting?`,
          },
        });
      },
      on: { SPEAK_COMPLETE: "ListenForResponse2" },
    },
    ListenForResponse2: {
      entry: ({ context }) => {
        context.lastActivity = Date.now(); 
        context.ssRef.send({
          type: "LISTEN",
        });
      },
      on: {
        RECOGNISED: [
          {
            guard: ({ event }) => isInGrammar(event.value[0].utterance),
            target: "Confirmation",
            actions: assign({
              time: ({ event }) => getTime(event.value[0].utterance),
            }),
          },
          {
            //  transition to Confirmation
            target: "Confirmation",
          },
        ],
      },
    },
    Confirmation: {
      type: "final",
      on: {
        RECOGNISED: {
          actions: [
            {
              type: "say",
              params: ({ context, event }) => {
                const response = getResponse(event.value[0].utterance);
                return response === "Yes"
                  ? `Your appointment with ${context.person} on ${context.day} at ${context.time} has been created.`
                  : "Let's start over.";
              },
            },
          ],
        },
      },
    },
  },
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  // Handle state changes here if needed
});

export function setupButton(element) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
    element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
  });
}
