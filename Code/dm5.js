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
    clearFields: assign({ name: null, day: null, time: null })
  }
}).createMachine({
  context: {
    name: null,
    day: null,
    time: null,
    name2: null,
    counter: 0
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
                        utterance: "Sorry, I didn't hear you.",
                      },
      }),
      on: {
            SPEAK_COMPLETE:
              [
                {   guard: ({context}) => context.counter < 3,   
                    target: "Main.hist",
                    actions: assign({ counter: ({ context }) => context.counter + 1 })
                },// control the times of reprompt
                {   guard: ({context}) => context.counter >= 3,   
                    target: "#DM.Done",
                    actions: [ assign({ counter: ({ context }) => context.counter + 1 }),
                      ({ context, event }) =>
                      context.ssRef.send({
                        type: "SPEAK",
                        value: {
                          utterance: `I will end our conversation`,
                        },
                      }),
                    ]
                },
              ],  
        }
    },
    Main: { 
      initial: "Greeting",
      on: { ASR_NOINPUT: "#DM.NoInput",},// Handle ASR_NOINPUT event
      states: {
        hist: {
          type: 'history',
          history: 'shallow' // optional; default is 'shallow'
        },
        Greeting:{
          entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Hey, welcome to your personal chatbot"),
          on: { SPEAK_COMPLETE: "TopPrompt" },
        }, 
        TopPrompt: { 
          initial: "Prompt",
          states: {
            Prompt:{
              entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "what can I help you?"),
              on: { SPEAK_COMPLETE: "IntentIdentify" },
            },        
            IntentIdentify: {
              entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true }}),
              on: { 
                RECOGNISED: [
                  { target: "#DM.Main.createMeeting" , 
                    guard:  ({ event }) => event.nluValue.topIntent === 'create a meeting'  &&  event.nluValue.intents[0].confidenceScore >= 0.8,
                    // actions: [ ({ event }) => console.log(event.nluValue),
                    //           ({ event }) => console.log(event.value) ] // look up the structure of nluValue
                    // actions: ({ event }) => console.log(event.nluValue.intents[0].confidenceScore) // look up the range of NLU confidenceScore
                    // when I say "I want to book a restaurant" or "I want to book a trip", the machine jumps to "createMeeting" with around 0.6 confidence value
                    // when I exactly say something about "create a meeting", the confidenceScore is around 0.9
                  },
                  { target: "#DM.Main.createMeetingClarify" , 
                    guard:  ({ event }) => event.nluValue.topIntent === 'create a meeting'  &&  event.nluValue.intents[0].confidenceScore < 0.8,
                  },
                  { target: "#DM.Main.whoisX" , 
                    guard:  ({ event }) =>  event.nluValue.topIntent === 'who is X' &&  event.nluValue.intents[0].confidenceScore >= 0.8 ,
                    // actions: ({ event }) => console.log(event.nluValue.intents[0].confidenceScore) // check the score; 
                    // when I say "I want to watch a moive" or "I want to become a millionaire", the machine jumps to "WhoisX" with around 0.5 confidence value
                    // when I just ask some information about X, the confidenceScore is around 0.8
                  },
                  { target: "#DM.Main.whoisXClarify" , 
                    guard:  ({ event }) =>  event.nluValue.topIntent === 'who is X' &&  event.nluValue.intents[0].confidenceScore < 0.8
                  },
                  {
                    target: "#DM.Main.ReIntentIdentify" , 
                    guard:  ({ event }) =>  event.nluValue.topIntent !== 'create a meeting' &&  event.nluValue.topIntent !== 'who is X'
                  }
                ]
            }
            },
          }
        },
        createMeetingClarify:{
          initial:"createMeetingConfirm",
          states: {
            createMeetingConfirm: {
              entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Did you say 'create a meeting'?"),
              on: { SPEAK_COMPLETE: "iscreateMeeting" },
            },
            iscreateMeeting: {
              entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true }}),
              on: {
                RECOGNISED: [
                  { target: "#DM.Main.createMeeting" , guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'accept' },
                  { target: "#DM.Main.ReIntentIdentify" , guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'decline' },
                  { target: "#DM.Main.ReIntentIdentify" , guard: ({event}) => event.nluValue?.entities?.[0]?.category !== 'accept' && event.nluValue?.entities?.[0]?.category !== 'decline' },
                ]
              }
            }
          }
        },
        whoisXClarify:{
          initial:"whoisXConfirm",
          states: {
            whoisXConfirm: {
              entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "You want to know someone, right?"),
              on: { SPEAK_COMPLETE: "iswhoisX" },
            },
            iswhoisX: {
              entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true }}),
              on: {
                RECOGNISED: [
                  { target: "#DM.Main.whoisX" , guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'accept' },
                  { target: "#DM.Main.ReIntentIdentify" , guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'decline' },
                  { target: "#DM.Main.ReIntentIdentify" , guard: ({event}) => event.nluValue?.entities?.[0]?.category !== 'accept' && event.nluValue?.entities?.[0]?.category !== 'decline' },
                ]
              }
            }
           }
        },
        ReIntentIdentify:{
          entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "Okay, so let's clarify your request. What can I help you? Please answer in grammar."),
          on: { SPEAK_COMPLETE: "TopPrompt.IntentIdentify" },
        }, 
        createMeeting: {
          entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "OK. Let's create an appointment."),
          on: { SPEAK_COMPLETE: "AskPersonPrompt" },
        },
        AskPersonPrompt:{
          initial: "AskPerson",
          states: {
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
                    guard: ({ event }) => event.nluValue?.entities?.[0]?.category === 'name' && event.value[0].confidence >= 0.6, 
                    // When I say a name like 'Vlad' clearly, the printed score is just around 0.6; and if I try with other more complex one, the score could be lower
                    // It seems that the threshold of ASR confidence score needs to be set lower than the pre-trained NLU model
                  },
                  { 
                    target: "WaitingForGetPersonComplete2",
                    actions: [
                      ({ context, event }) => {
                        context.ssRef.send({
                            type: "SPEAK",
                            value: {
                              utterance: `Did you say ${
                                event.value[0].utterance
                              }?`,
                            },
                          });
                        },
                      // ({ event }) => console.log(event.value),
                      // ({ event }) => console.log(event.nluValue),
                      assign({ name: ({context, event}) => event.nluValue.entities[0].text })
                    ],
                    guard: ({ event }) => event.nluValue?.entities?.[0]?.category === 'name' && event.value[0].confidence < 0.6,
                  },
                  { 
                    target: "WaitingForGetPersonComplete3",
                    actions: ({ context, event }) =>
                        context.ssRef.send({
                          type: "SPEAK",
                          value: {
                            utterance: `Sorry, I didn't understand. Who are you meeting with? Please just say the name like Vlad.`,
                          },
                        }),
                    guard: ({event}) => !event.nluValue || event.nluValue?.entities?.[0]?.category !== 'name',
                  },
                ]                
                },
            },
            WaitingForGetPersonComplete1: {
              on: {
                SPEAK_COMPLETE: "#DM.Main.AskDayPrompt"
              }
            },
            WaitingForGetPersonComplete2: {
              on: {
                SPEAK_COMPLETE: "GetPersonConfirm"
              }
            },
            WaitingForGetPersonComplete3: {
              on: {
                SPEAK_COMPLETE: "GetPerson"
              }
            },
            GetPersonConfirm: {
              entry: ({ context }) => context.ssRef.send({ type: "LISTEN", value: { nlu: true }}),
              on: {
                RECOGNISED: [
                  { target: "WaitingForGetPersonConfirm1" , 
                    actions: ({ context, event }) =>
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `OK, I got it! Let's continue with other details`,
                      },
                    }),
                    guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'accept' },
                  { target: "WaitingForGetPersonConfirm2" ,
                    actions: ({ context, event }) =>
                        context.ssRef.send({
                          type: "SPEAK",
                          value: {
                            utterance: `That's fine. I will ask you again`,
                          },
                        }),
                    guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'decline' },
                  { target: "WaitingForGetPersonComplete2" ,
                    actions: ({ context, event }) =>
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `Sorry, I didn't understand. Did you say ${event.value[0].utterance}? Please say yes or no.`,
                      },
                    }),
                    guard: ({event}) => event.nluValue?.entities?.[0]?.category !== 'accept' && event.nluValue?.entities?.[0]?.category !== 'decline' }
                ]
              }
            },
            WaitingForGetPersonConfirm1: {
              on: {
                SPEAK_COMPLETE: "#DM.Main.AskDayPrompt"
              }
            },
            WaitingForGetPersonConfirm2: {
              on: {
                SPEAK_COMPLETE: "AskPerson"
              }
            }
          }
        },
        AskDayPrompt:{
          initial: "AskDay",
          states: {
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
                        type: "SPEAK",
                        value: {
                          utterance: `Sorry, I didn't understand. On which day is your meeting? Please answer like Friday.`,
                        },
                      }),
                    guard: ({event}) => event.nluValue?.entities?.[0]?.category !== 'day' ,
                  },
                ]
              }
            },
            WaitingForGetDayComplete1: {
              on: {
                SPEAK_COMPLETE: "#DM.Main.AskFullDayPrompt"
              }
            },
            WaitingForGetDayComplete2: {
              on: {
                SPEAK_COMPLETE: "GetDay"
              }
            }
          }
        },
        AskFullDayPrompt:{
          initial:"AskFullDay",
          states:{
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
                  { target: "#DM.Main.ConfirmCreateFullDayAppointment" , guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'accept' },
                  { target: "#DM.Main.AskTimePrompt" , guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'decline' },
                  { target: "AskFullDay",
                    actions: ({ context, event }) =>
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `Sorry, I can't understand you. Will the meeting take the whole day, please say "yes" or "no".`,
                      }, 
                    }),
                    guard: ({event}) => event.nluValue?.entities?.[0]?.category !== 'accept' && event.nluValue?.entities?.[0]?.category !== 'decline' },
                ]
              },
            },
          }
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
              { target: "#DM.Main.createMeeting",
                actions: [ ({ context, event }) =>
                context.ssRef.send({
                  type: "SPEAK",
                  value: {
                    utterance: `Ok, I will ask again from scratch.`,
                  },
                }),
                "clearFields" ],
                guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'decline' },
              { target: "ReCreateFullDayAppointment",
                actions: ({ context, event }) =>
                context.ssRef.send({
                  type: "SPEAK",
                  value: {
                    utterance: `Sorry, I didn't understand you. Do you want me to create an appointment with ${context.name} on ${context.day} for the whole day? Please say "yes" or "no".`,
                  }, 
                }),
                guard: ({event}) => event.nluValue?.entities?.[0]?.category !== 'accept' || event.nluValue?.entities?.[0]?.category !== 'decline' },
            ],
          },
        },
        ReCreateFullDayAppointment: {
          on: {
            SPEAK_COMPLETE: "CreateFullDayAppointment"
          }
        },
        AskTimePrompt: {
          initial:"AskTime",
          states:{
            AskTime:{
            entry: ({ context }) => sendSpeechCommand(context.ssRef, "SPEAK", "What time is your meeting?"),
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
                      utterance: `Sorry, I didn't understand you. What time is your meeting, please answer like "eleven"`,
                      },
                    }), 
                    // ({ event }) => console.log(event.Value)
                  ],
                  guard: ({event}) => event.nluValue?.entities?.[0]?.category !== 'time' },
                  
              ]
              }
            },
            WaitingForGetTimeComplete1: {
              on: {
                SPEAK_COMPLETE: "#DM.Main.AskPartialDay"
              }
            },
            WaitingForGetTimeComplete2: {
              on: {
                SPEAK_COMPLETE: "GetTime"
              }
            },
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
              { target: "#DM.Main.createMeeting", 
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
                    utterance: `Sorry, I didn't understand you. Do you want me to create an appointment with ${context.name} on ${context.day} at ${context.time}? Please say "yes" or "no".`,
                  }, 
                }),
                guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'accept' && event.nluValue?.entities?.[0]?.category === 'decline' },
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
        },
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
                guard: ({event}) => event.nluValue?.entities?.[0]?.category !== 'name2',
              },
            ]                
            },
          },
        WaitingForGetXComplete1: {
          on: {
            SPEAK_COMPLETE: "AskDetailPrompt"
          }
        },
        WaitingForGetXComplete2: {
          on: {
            SPEAK_COMPLETE: "GetX"
          }
        },
        AskDetailPrompt:{
          initial: "AskDetail",
          states:{
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
                      ({ event }) => console.log(event.nluValue)
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
                              // For more examples, here utterance can be stored in grammar to make the code more abstract and reusable
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
                            }. And it is not in the grammar. Please ask something like representative works.`,
                          },
                        }),
                    guard: ({event}) => event.nluValue?.entities?.[0]?.extraInformation?.[0]?.key !== 'Representative works',
                  },
                  { 
                      target: "AskXCompleted",
                      guard: ({event}) => event.nluValue?.entities?.[0]?.category === 'decline'
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
          },
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