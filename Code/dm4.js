import { assign, createActor, setup, } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure.js";

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
    endpoint: "https://languge-resource-xiumei.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview" /** your Azure CLU prediction URL */,
    key: NLU_KEY /** reference to your Azure CLU key */,
    deploymentName: "appointment" /** your Azure CLU deployment */,
    projectName: "appointment." /** your Azure CLU project name */,
};  

const settings = {
  azureLanguageCredentials: azureLanguageCredentials /** global activation of NLU */,
  azureCredentials,
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000, // default value
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

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
  }
}).createMachine({
  context: {
    name: null,
    day: null,
    time: null,
    name2: null
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
        CLICK: "Main",
        TIMER_EXPIRED: "Main", // Handle inactivity event
      },
    },
    NoInput: {
      entry: ( {context} ) =>
        context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: "I didn't hear you. Please repeat your answer.",
                      },
      }),
      on: {
            SPEAK_COMPLETE: "Main.hist"
          }
    },
    Main: { 
      initial: "Prompt",
      on: { ASR_NOINPUT: "#DM.NoInput",},// Handle ASR_NOINPUT event
      states: {
        hist: {
          type: 'history',
          history: 'deep' // optional; default is 'shallow'
        },
        Prompt:{
          entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Hey, what can I help you?"),
          on: { SPEAK_COMPLETE: "IntentIdentify" },
        },        
        IntentIdentify: {
          entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true }}),
          on: { 
            RECOGNISED: [
              { target: "createMeetingPrompt" , 
                guard:  ({ event }) => event.nluValue.topIntent === 'create a meeting',
                // action: ({ event }) => console.log(event.nluValue) // look up the structure of nluValue
              },
              { target: "whoisXPrompt" , 
                guard:  ({ event }) =>  event.nluValue.topIntent === 'who is X'
              },
            ]
         }
        },
        createMeetingPrompt:{
          initial: "createMeeting",
          states: {
            createMeeting: {
              entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "OK. Let's create an appointment."),
              on: { SPEAK_COMPLETE: "AskPerson" },
            },        
            AskPerson: {
              entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Who are you meeting with?"),
              on: { SPEAK_COMPLETE: "GetPerson" },
              },
            GetPerson: {
              entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true }}),
              on: {
                RECOGNISED: [
                  { 
                    target: "WaitingForGetPersonComplete1",
                    actions: [
                      ({ context, event }) => {
                        context.ssRef.send({
                            type: "SPEAK",
                            value: {
                              utterance: `You just said: ${
                                event.value[0].utterance
                              }. And it is in the grammar.`,
                            },
                          });
                        },
                      assign({ name: ({context, event}) => event.nluValue.entities[0].text }),  
                    ],
                    guard: ({ event }) => event.nluValue?.entities?.[0]?.category === 'name',
                  },
                  { 
                    target: "WaitingForGetPersonComplete2",
                    actions: ({ context, event }) =>
                        context.ssRef.send({
                          type: "SPEAK",
                          value: {
                            utterance: `You just said: ${
                              event.value[0].utterance
                            }. And it is not in the grammar. Please answer again.`,
                          },
                        }),
                    guard: ({event}) => !event.nluValue || event.nluValue?.entities?.[0]?.category !== 'name',
                  },
                ]                
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
              entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true }}),
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
                      assign({ day: ({context, event}) => event.nluValue.entities[0].text }),
                    ],
                    guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'day' },
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
                    guard: ({event}) => !event.value || !event.nluValue || event.nluValue?.entities?.[0]?.category !== 'day' ,
                  },
                ]
              }
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
              entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true }}), 
              on: {
                RECOGNISED: [
                  { target: "ConfirmCreateFullDayAppointment" , guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'accept' },
                  { target: "AskTime" , guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'decline' },
                  { target: "AskFullDay",
                    actions: ({ context, event }) =>
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `Sorry, I can't understand you. Please answer again.`,
                      }, 
                    }),
                    guard: ({event}) => !event.nluValue },
                ]
              },
            },
            ConfirmCreateFullDayAppointment: {
              entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", `Ok, let's make a confirmation. Do you want me to create an appointment with ${context.name} on ${context.day} for the whole day?`),
              on: {
                SPEAK_COMPLETE:"CreateFullDayAppointment",
              },
            },
            CreateFullDayAppointment: {
              entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true }}), 
              on: {
                RECOGNISED: [
                  { target: "AppointmentCreated", guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'accept' },
                  { target: "#DM.Main.createMeetingPrompt",
                    actions: [ ({ context, event }) =>
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `Ok, I will ask you again.`,
                      },
                    }),
                    "clearFields" ],
                    guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'decline' },
                  { target: "ReCreateFullDayAppointment",
                    actions: ({ context, event }) =>
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `Sorry, I can't understand you. Please answer again.`,
                      }, 
                    }),
                    guard: ({event}) => !event.nluValue },
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
              entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true }}), 
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
                  assign({ time: ({context, event}) => event.nluValue.entities[0].text }),
                ], 
                guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'time' },
                { target: "WaitingForGetTimeComplete2" , 
                  actions: [ ({ context, event }) =>
                    context.ssRef.send({
                    type: "SPEAK",
                    value: {
                      utterance: `You just said: ${
                        event.value[0].utterance
                        }. And it is not in the grammar. Please answer again.`,
                      },
                    }), 
                   ({ event }) => console.log(event.Value)],
                  guard: ({event}) => !event.nluValue || event.nluValue?.entities?.[0]?.category !== 'time' },
                  
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
              entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", `So let's check all the information. Do you want me to create an appointment with ${context.name} on ${context.day} at ${context.time}?`),
              on: {
                SPEAK_COMPLETE:"ConfirmPartialDay",
                },
            },
            ConfirmPartialDay: {
              entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true }}), 
              on: {
                RECOGNISED: [
                  { target: "AppointmentCreated", guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'accept' },
                  { target: "#DM.Main.createMeetingPrompt", 
                    actions: [ ({ context, event }) =>
                      context.ssRef.send({
                        type: "SPEAK",
                        value: {
                          utterance: `Ok, I will ask you again.`,
                        },
                      }),
                    "clearFields" ],
                    guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'decline' },
                  { target: "ReConfirmPartialDay",
                    actions: ({ context, event }) =>
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `Sorry, I cannot understand you. Please answer again.`,
                      }, 
                    }),
                    guard: ({event}) => !event.nluValue },
                  ],
              },
            },
            ReConfirmPartialDay: {
              on: {
                SPEAK_COMPLETE: "ConfirmPartialDay"
              }
            },
            AppointmentCreated: {
              entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Great! Your appointment has been created!"),
              SPEAK_COMPLETE: "#DM.Done",
            }
          }
        },
        whoisXPrompt:{
          initial: "whoisX",
          states: {
            whoisX: {
              entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "OK! Let me check your request. Who do you want to know?"),
              on: { SPEAK_COMPLETE: "GetX" },
            }, 
            GetX: {
              entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true }}),
              on: {
                RECOGNISED: [
                  { 
                    target: "WaitingForGetXComplete1",
                    actions: [
                      ({ context, event }) => {
                        context.ssRef.send({
                            type: "SPEAK",
                            value: {
                              utterance: `BTS, also known as the Bangtan Boys, is a South Korean boy band formed in 2010. The band consists of Jin, Suga, J-Hope, RM, Jimin, V, and Jungkook, who co-write or co-produce much of their material.`,
                            },
                          });
                        },
                      assign({ name2: ({context, event}) => event.nluValue?.entities?.[0].text }),  
                    ],
                    guard: ({ event }) => event.nluValue?.entities?.[0]?.text === 'BTS',
                  },
                  { 
                    target: "WaitingForGetXComplete1",
                    actions: [
                      ({ context, event }) => {
                        context.ssRef.send({
                            type: "SPEAK",
                            value: {
                              utterance: `Taylor Alison Swift is an American singer-songwriter. Her artistry and entrepreneurship have influenced the music industry, popular culture, and politics, while her life is a subject of widespread media coverage.`,
                            },
                          });
                        },
                      assign({ name2: ({context, event}) => event.nluValue?.entities?.[0].text }),  
                    ],
                    guard: ({ event }) => event.nluValue?.entities?.[0]?.text === 'Taylor Swift',
                  },
                  { 
                    target: "WaitingForGetXComplete1",
                    actions: [
                      ({ context, event }) => {
                        context.ssRef.send({
                            type: "SPEAK",
                            value: {
                              utterance: `Jackie Chan is a Hong Kong actor, director, writer, producer, martial artist, and stuntman known for his slapstick acrobatic fighting style, comic timing, and innovative stunts, which he typically performs himself.`,
                            },
                          });
                        },
                      assign({ name2: ({context, event}) => event.nluValue?.entities?.[0].text }),  
                    ],
                    guard: ({ event }) => event.nluValue?.entities?.[0]?.text === 'Jackie Chan',
                  },
                  { 
                    target: "WaitingForGetXComplete2",
                    actions: ({ context, event }) =>
                        context.ssRef.send({
                          type: "SPEAK",
                          value: {
                            utterance: `Sorry, you just said: ${
                              event.value[0].utterance
                            }. And it is not in the grammar. Please ask a celebrity in grammar again.`,
                          },
                        }),
                    guard: ({event}) => !event.nluValue || event.nluValue?.entities?.[0]?.category !== 'name2',
                  },
                ]                
                },
              },
              WaitingForGetXComplete1: {
                on: {
                  SPEAK_COMPLETE: "AskDetail"
                }
              },
              WaitingForGetXComplete2: {
                on: {
                  SPEAK_COMPLETE: "GetX"
                }
              },
              AskDetail:{
                entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", `What else do you want to know about ${context.name2}`),
                on: {
                  SPEAK_COMPLETE:"GetDetail",
                },
              },
              GetDetail: {
                entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true }}),
                on: {
                  RECOGNISED: [
                    { 
                      target: "WaitingForGetDetailComplete1",
                      actions: [
                        ({ context, event }) => {
                          context.ssRef.send({
                              type: "SPEAK",
                              value: {
                                utterance: `I want to recommend "Spring Day", a song recorded in their 2017 album You Never Walk Alone, showing comfort and sharing hope to the youth.`,
                              },
                            });
                          },
                        // ({ event }) => console.log(event.nluValue)
                      ],
                      // guard: ({ context, event }) => event.nluValue?.entities?.[0].category === 'detail' && context.name2 === "BTS",
                      guard: ({ context, event }) => event.nluValue?.entities?.[0]?.extraInformation?.[0]?.key === 'Representative works' && context.name2 === "BTS",
                    },
                    { 
                      target: "WaitingForGetDetailComplete1",
                      actions: [
                        ({ context, event }) => {
                          context.ssRef.send({
                              type: "SPEAK",
                              value: {
                                utterance: `I want to recommend "1989", the fifth studio album released in 2014. Inspired by 1980s synth-pop, Swift titled 1989 after her birth year as a symbolic artistic rebirth.`,
                              },
                            });
                          },
                      ],
                      guard: ({ context, event }) => event.nluValue?.entities?.[0]?.extraInformation?.[0]?.key === 'Representative works' && context.name2 === "Taylor Swift",
                    },
                    { 
                      target: "WaitingForGetDetailComplete1",
                      actions: [
                        ({ context, event }) => {
                          context.ssRef.send({
                              type: "SPEAK",
                              value: {
                                utterance: `I want to recommend "The Forbidden Kingdom", a 2008 wuxia film based on the 16th-century novel Journey to the West. It is also the first film featuring exciting fight scenes between martial arts legends Jackie Chan and Jet Li.`,
                              },
                            });
                          },
                      ],
                      guard: ({ context, event }) => event.nluValue?.entities?.[0]?.extraInformation?.[0]?.key === 'Representative works' && context.name2 === "Jackie Chan",
                    },
                    { 
                      target: "WaitingForGetDetailComplete2",
                      actions: ({ context, event }) =>
                          context.ssRef.send({
                            type: "SPEAK",
                            value: {
                              utterance: `Sorry, you just said: ${
                                event.value[0].utterance
                              }. And it is not in the grammar. Please ask again.`,
                            },
                          }),
                      guard: ({event}) => !event.nluValue || event.nluValue?.entities?.[0]?.category !== 'detail',
                    },
                  ]                
                  },
              },
              WaitingForGetDetailComplete1: {
                on: {
                  SPEAK_COMPLETE: "AskXCompleted"
                }
              },
              WaitingForGetDetailComplete2: {
                on: {
                  SPEAK_COMPLETE: "GetDetail"
                }
              },
              AskXCompleted: {
                entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Great! If you have any other question, please let me know."),
                SPEAK_COMPLETE: "#DM.Done",
              }
        }
        }
      }
    },
    Done: {
      on: {
        CLICK: "Main",
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

// debugging & improvement insights
// 1. About entity overlapping: 
// If a single answer can be mapped to sereral keys of one entity, only one key could be mapped successfully;
// or if different entities share a same list, the call will fail(I tried to share a prebuilt DateTime list but failed).

// 2. About "undefined":
// For some cases of recognition failure, using "?" before an attribute can optimize our code to make it flexible to deal with similar situations.

// 3. About "improve NLU coverage":
// By enriching entities and constructing a more elastic dialogue structure, we can improve NLU coverage.