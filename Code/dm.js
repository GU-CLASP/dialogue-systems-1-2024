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
  asrDefaultNoInputTimeout: 5000, // default value
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
  return ['yes', 'yeah', 'sure', 'absolutely', 'of course'].includes(utterance.toLowerCase());
}

function isNo(utterance) {
  return ['no', 'nope', 'nah', 'never', 'no way'].includes(utterance.toLowerCase());
}


const dmMachine = setup({
  devTools: true,
  actions: {
    say: ({ context }, params) => sendSpeechCommand(context.ssRef, "SPEAK", params),
    startTimer: ({ context }) => {
      setTimeout(() => {
        dmActor.send({ type: "TIMER_EXPIRED" });
      }, 10000);// 10s limit
    },
    clearFields: assign({ name: null, day: null, time: null }),
    assignName: assign({ name: ({context, event}) => getPerson(event.value[0].utterance) }),
    assignDay: assign({ day: ({context, event}) => getDay(event.value[0].utterance) }),
    assignTime: assign({ time: ({context, event}) => getTime(event.value[0].utterance) }),
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
        CLICK: "PromptAndAsk",
        TIMER_EXPIRED: "PromptAndAsk", // Handle inactivity event
      },
    },
    PromptAndAsk: { 
      initial: "Main",
      on: { ASR_NOINPUT: ".NoInput" },// Handle ASR_NOINPUT event
      states: {
        NoInput: {
          entry: ( {context} ) =>
            context.ssRef.send({
                          type: "SPEAK",
                          value: {
                            utterance: `"I didn't hear you. Please repeat your answer."`,
                          },
          }),
          on: {
                SPEAK_COMPLETE: "Main.hist"
              }
          }, 
        Main:{
          initial: "Prompt",
          states: {
            hist: {
            type: 'history',
            history: 'shallow' // optional; default is 'shallow'
            },
            Prompt:{
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
                RECOGNISED: [
                  { target: "WaitingForGetPersonComplete1" , 
                    actions:  [ ({ context, event }) =>
                      context.ssRef.send({
                        type: "SPEAK",
                        value: {
                        utterance: `You just said: ${
                          event.value[0].utterance
                          }. And it is in the grammar.`,
                        },
                      }),
                      "assignName"
                    ],
                    guard: ({event}) => isInGrammar(event.value[0].utterance) },
                  { target: "WaitingForGetPersonComplete2" , 
                    actions: ({ context, event }) =>
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `You just said: ${
                          event.value[0].utterance
                        }. And it is not in the grammar. Please answer again.`,
                      },
                    }),
                    guard: ({event}) => !isInGrammar(event.value[0].utterance) },
                ],
              },
            },
            WaitingForGetPersonComplete1: {
              on: {
                SPEAK_COMPLETE: "AskDay"
              }
            },
            WaitingForGetPersonComplete2: {
              on: {
                SPEAK_COMPLETE: "GetPerson"
              }
            },
            AskDay: {
              entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "On which day is your meeting?"),
              on: { SPEAK_COMPLETE: "GetDay" },
            },
            GetDay: {
              entry: ({ context }) => context.ssRef.send({ type: "LISTEN" }), 
              on: {
                RECOGNISED: [
                  { target: "WaitingForGetDayComplete1" , 
                    actions: [ ({ context, event }) =>
                      context.ssRef.send({
                        type: "SPEAK",
                        value: {
                          utterance: `You just said: ${
                            event.value[0].utterance
                          }. And it is in the grammar.`,
                        },
                      }),
                    "assignDay"
                    ],
                    guard: ({event}) => isInGrammar(event.value[0].utterance) },
                  { target: "WaitingForGetDayComplete2" , 
                    actions: ({ context, event }) =>
                      context.ssRef.send({
                        type: "WaitingForGetDayComplete2",
                        value: {
                          utterance: `You just said: ${
                            event.value[0].utterance
                          }. And it is not in the grammar. Please answer again.`,
                        },
                      }),
                    guard: ({event}) => !isInGrammar(event.value[0].utterance) },
                ], 
              },
            },
            WaitingForGetDayComplete1: {
              on: {
                SPEAK_COMPLETE: "AskFullDay"
              }
            },
            WaitingForGetDayComplete2: {
              on: {
                SPEAK_COMPLETE: "GetDay"
              }
            },
            AskFullDay: {
              entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Will it take the whole day?"),
              on: {
                SPEAK_COMPLETE:"GetIsFullDay",
              },
            },
            GetIsFullDay: {
              entry: ({ context }) => { context.ssRef.send({ type: "LISTEN" }); }, 
              on: {
                RECOGNISED: [
                  { target: "ConfirmCreateFullDayAppointment" , guard: ({event}) => isYes(event.value[0].utterance) },
                  { target: "AskTime" , guard: ({event}) => isNo(event.value[0].utterance) },
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
              on: {
                RECOGNISED: [
                  { target: "AppointmentCreated", guard: ({event}) => isYes(event.value[0].utterance) },
                  { target: "AskPerson",
                    actions: ({ context, event }) =>
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `Ok, I will ask you again.`,
                      },
                    }),
                    guard: ({event}) => isNo(event.value[0].utterance), actions: "clearFields" },
                  { target: "ReCreateFullDayAppointment",
                    actions: ({ context, event }) =>
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `Sorry, I cannot understand you. Please answer again.`,
                      }, 
                    }),
                    guard: ({event}) => !isYes(event.value[0].utterance) && !isNo(event.value[0].utterance) },
                ],
              },
            },
            ReCreateFullDayAppointment: {
              on: {
                SPEAK_COMPLETE: "CreateFullDayAppointment"
              }
            },
            AskTime: {
              entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "You just said your appointment would not take the whole day, so what time is your meeting?"),
              on: {
                SPEAK_COMPLETE:"GetTime",
                },
            },
            GetTime: {
              entry: ({ context }) => context.ssRef.send({ type: "LISTEN" }), 
              on: { 
              RECOGNISED: [
                { target: "WaitingForGetTimeComplete1" , 
                  actions: [ ({ context, event }) =>
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `You just said: ${
                          event.value[0].utterance
                        }. And it is in the grammar.`,
                      },
                    }),
                  "assignTime"
                ], 
                guard: ({event}) => isInGrammar(event.value[0].utterance) },
                { target: "WaitingForGetTimeComplete2" , 
                  actions: ({ context, event }) =>
                    context.ssRef.send({
                    type: "SPEAK",
                    value: {
                      utterance: `You just said: ${
                        event.value[0].utterance
                        }. And it is not in the grammar. Please answer again.`,
                      },
                    }), 
                  guard: ({event}) => !isInGrammar(event.value[0].utterance) },
              ]
              }
            },
            WaitingForGetTimeComplete1: {
              on: {
                SPEAK_COMPLETE: "AskPartialDay"
              }
            },
            WaitingForGetTimeComplete2: {
              on: {
                SPEAK_COMPLETE: "GetTime"
              }
            },
            AskPartialDay: {
              entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", `Do you want me to create an appointment with ${context.name} on ${context.day} at ${context.time}?`),
              on: {
                SPEAK_COMPLETE:"ConfirmPartialDay",
                },
            },
            ConfirmPartialDay: {
              entry: ({ context }) => context.ssRef.send({ type: "LISTEN" }), 
              on: {
                RECOGNISED: [
                  { target: "AppointmentCreated", guard: ({event}) => isYes(event.value[0].utterance) },
                  { target: "AskPerson", 
                    actions:  ({ context, event }) =>
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `Ok, I will ask you again.`,
                      },
                    }), 
                    guard: ({event}) => isNo(event.value[0].utterance), actions: "clearFields" },
                  { target: "" , 
                    actions: ({ context, event }) =>
                      context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `You just said: ${
                          event.value[0].utterance
                          }. And it is not in the grammar. Please answer again.`,
                        },
                      }), 
                    guard: ({event}) => !isInGrammar(event.value[0].utterance) },
                  { target: "ReConfirmPartialDay",
                    actions: ({ context, event }) =>
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `Sorry, I cannot understand you. Please answer again.`,
                      }, 
                    }),
                    guard: ({event}) => !isYes(event.value[0].utterance) && !isNo(event.value[0].utterance) },
                  ],
              },
            },
            ReConfirmPartialDay: {
              on: {
                SPEAK_COMPLETE: "ConfirmPartialDay"
              }
            },
            AppointmentCreated: {
              entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Your appointment has been created!"),
              SPEAK_COMPLETE: "#DM.Done",
            }
          }
        }
      }
    },
    Done: {
      on: {
        CLICK: "PromptAndAsk",
      },
    },
  }
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