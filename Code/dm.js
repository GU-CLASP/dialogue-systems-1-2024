import { assign, createActor, setup, } from "xstate";
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
  azureCredentials,
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

const grammar = {
  vlad: { person: "Vladislav Maraev" },
  aya: { person: "Nayat Astaiza Soriano" },
  rasmus: { person: "Rasmus Blanck" },
  alice: { person: "Alice" }, // extended
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  friday: { day: "Friday" }, // extended
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

// copy the given structure to store variable in context
function getDay(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).day;
}

function getTime(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).time;
}

// Define general conditional predicate function
function isYes(utterance) {
  return ['yes', 'yeah', 'sure', 'absolutely', 'ofcourse'].includes(utterance.toLowerCase());
}

function isNo(utterance) {
  return ['no', 'nope', 'nah', 'never', 'noway'].includes(utterance.toLowerCase());
}


const dmMachine = setup({
  devTools: true,
  actions: {
    say: ({ context }, params) => sendSpeechCommand(context.ssRef, "SPEAK", params),
    handleNoInput: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "I didn't hear you. Please repeat your response."),
    startTimer: ({ context }) => {
      setTimeout(() => {
        dmActor.send({ type: "TIMER_EXPIRED" });
      }, 10000);// 10s limit
    },
    clearFields: assign({ name: null, day: null, time: null }),
    assignName: assign({ name: (context, event) => {
      console.log(event.flag);
      getPerson(event.value[0].utterance);
   } }),
    assignDay: assign({ day: (context, event) => getDay(event.value[0].utterance) }),
    assignTime: assign({ time: (context, event) => getTime(event.value[0].utterance) }),
  }
}).createMachine({
  context: {
    name: null,
    day: null,
    time: null,
  },
  id: "DM",
  initial: "Prepare",
  states: {
    Prepare: {
      entry: [
        assign({ ssRef: ({ spawn }) => spawn(speechstate, { input: settings }) }),
        ({ context }) => sendSpeechCommand(context.ssRef, "PREPARE"),
        "startTimer",
      ],
      on: { ASRTTS_READY: "WaitToStart" },
    },
    WaitToStart: {
      entry: "startTimer",
      on: {
        CLICK: "Prompt",
        ASR_NOINPUT: {
          actions: "handleNoInput",
          target: "Prompt",
        }, // Handle ASR_NOINPUT event
        TIMER_EXPIRED: "Prompt", // Handle inactivity event
      },
    },
    Prompt: {
      entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Let's create an appointment."),
      on: { SPEAK_COMPLETE: "AskPerson" },
    },
    AskPerson: {
      entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Who are you meeting with?"),
      on: { SPEAK_COMPLETE: "GetPerson" },
    },
    GetPerson: {
      entry: ({ context }) => context.ssRef.send({ type: "LISTEN" }),
      on: {
        RECOGNISED: {
          actions: [
            ({ context, event }) =>
              context.ssRef.send({
                type: "SPEAK",
                value: {
                  utterance: `You just said: ${
                    event.value[0].utterance
                  }. And it ${
                    isInGrammar(event.value[0].utterance) ? "is" : "is not"
                  } in the grammar.`,
                },
              }),
            //"assignName",
          ],
          target: "WaitingForSpeakComplete1",
        },
      },
    },
    WaitingForSpeakComplete1: {
      on: {
        SPEAK_COMPLETE: "AskDay"
      }
    },
    AskDay: {
      entry: ({ context }) => {
        // console.log("Sending SPEAK command...");
        sendSpeechCommand(context.ssRef, "SPEAK", "On which day is your meeting?");
      },
      on: {
        SPEAK_COMPLETE: {
          actions: () => {
            // console.log("SPEAK command completed.");
          },
          target: "GetDay",
        },
      },
    },
    GetDay: {
      entry: ({ context }) => context.ssRef.send({ type: "LISTEN" }), 
      on: {
        RECOGNISED: {
          actions: [
            ({ context, event }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: `You just said: ${
                  event.value[0].utterance
                }. And it ${
                  isInGrammar(event.value[0].utterance) ? "is" : "is not"
                }   in the grammar.`,
              },
            }),
            //"assignDay",
          ],
          target: "WaitingForSpeakComplete2",
        },
      },
    },
    WaitingForSpeakComplete2: {
      on: {
        SPEAK_COMPLETE: "AskFullDay"
      }
    },
    AskFullDay: {
      entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Will it take the whole day?"),
      on: {
        SPEAK_COMPLETE:"GetIsFullDay",
        },
    },
    GetIsFullDay: {
      entry: ({ context }) => {
        // console.log("GetIsFullDay state entry, sending LISTEN command");
        context.ssRef.send({ type: "LISTEN" });
      }, 
      on: {
        RECOGNISED: [
          { target: "ConfirmCreateFullDayAppointment" , guard: (context, event) => isYes(event.value[0].utterance) },
          { target: "AskTime" , guard: (context, event) => isNo(event.value[0].utterance) },
        ]
      },
    },
    ConfirmCreateFullDayAppointment: {
      entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", `Do you want me to create an appointment with ${context.name} on ${context.day} for the whole day?`),
      on: {
        SPEAK_COMPLETE:"CreateFullDayAppointment",
        },
    },
    CreateFullDayAppointment: {
      entry: ({ context }) => context.ssRef.send({ type: "LISTEN" }), 
      on: [
        { target: "AppointmentCreated", guard: (context, event) => isYes(event.value[0].utterance) },
        { target: "AskPerson", guard: (context, event) => isNo(event.value[0].utterance), actions: "clearFields" },
      ],
    },
    AskTime: {
      entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "What time is your meeting?"),
      on: {
        SPEAK_COMPLETE:"GetTime",
        },
    },
    GetTime: {
      entry: ({ context }) => context.ssRef.send({ type: "LISTEN" }), 
      on: { RECOGNISED: { target: "AskPartialDay", actions: ["assignTime"],}},
    },
    AskPartialDay: {
      entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", `Do you want me to create an appointment with ${context.name} on ${context.day} at ${context.time}?`),
      on: {
        SPEAK_COMPLETE:"ConfirmPartialDay",
        },
    },
    ConfirmPartialDay: {
      entry: ({ context }) => context.ssRef.send({ type: "LISTEN" }), 
      on: [
        { target: "AppointmentCreated", guard: (context, event) => isYes(event.value[0].utterance) },
        { target: "AskPerson", guard: (context, event) => isNo(event.value[0].utterance), actions: "clearFields" },
      ],
    },
    AppointmentCreated: {
      entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Your appointment has been created!"),
      type: "final",
    },
  },
});

const dmActor = createActor(dmMachine, { inspect: inspector.inspect }).start();

dmActor.subscribe((state) => {
  console.log(state)
});

dmActor.send({
  type: "say",
  params: "Hello world!",
});

export function setupButton(element) {
  element.addEventListener("click", () => dmActor.send({ type: "CLICK" }));

  dmActor.getSnapshot().context.ssRef.subscribe(({ value }) => {
    element.innerHTML = `${value.AsrTtsManager.Ready}`;
  });
}

function sendSpeechCommand(ssRef, type, utterance) {
  ssRef.send({ type, value: { utterance } });
}