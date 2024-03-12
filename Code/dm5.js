import { assign, createActor, enqueueActions, setup, raise, and } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY } from "./azure.js";
import { NLU_KEY } from "./azure.js";


const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
  endpoint: "https://lab4-lg-resource.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview" /** your Azure CLU prediction URL */,
  key: NLU_KEY /** reference to your Azure CLU key */,
  deploymentName: "Appointment0" /** your Azure CLU deployment */,
  projectName: "AppointmentLab4" /** your Azure CLU project name */,
};

const settings = {
  azureLanguageCredentials: azureLanguageCredentials,
  azureCredentials: azureCredentials,
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};

/* Grammar definition */
const confirm = {
  yes: { bool: true },
  sure: { bool: true },
  "of course": { bool: true },
  right: { bool: true },
  yup: { bool: true },
  yep: { bool: true },
  ja: { bool: true },
  yea: { bool: true },
  yeah: { bool: true },
  no: { bool: false},
  nope: { bool: false},
  nah: { bool: false},
  "no way": { bool: false},
};

const infobox = {
  "Christopher Nolan": {info: "Christopher Nolan is a British-American filmmaker."},
  "Billie Eilish": {info: "Billie Eilish is an American singer and songwriter."},
  "Rosa Parks": {info: "Rosa Parks was an integral activist in the civil rights movement in America"}
};

const helpbox = {
  "Intents": {text: "You can either book an appointment or ask about one of these famous people: Billie Eilish, Christopher Nolan, Rosa Parks."},
  "Meeting": {text: "You can meet with Christine Howes, Rasmus Blanck or Vladislav Maraev on weekdays either at a specific time, or for the whole day."},
  "ConfirmQ": {text: "Please reply with yes or no."},
  "Timeslots" : {text: "You can book meetings at full hours from 8am to 4pm."}
};

const promptbox = {
  "NoInputState": {0:"I didn't hear you.", 1:"Sorry, I didnt get that.", 2:"I didn't catch that."},
  "GetIntent": {0:"How can I help you?", 1:"What can I help you with?", 2:"What can I do for you?"},
  "CheckMeetingStatus": {0:"Let's see:", 1:"Alright:", 2:"Well then:"},
  "GetPerson": {0:"Who are you meeting with?", 1:"Who would you like to meet?", 2:"With whom should I book your appointment?"},
  "GetDay": {0:"On which day would you like to meet?", 1:"For which day should I book your appointment?", 2:"On what day would you be available?"},
  "GetWholeDay": {0:"Will it take the whole day?", 1:"Is your meeting going to take an entire day?", 2:"Do you need the whole day for your appointment?"},
  "GetTime": {0:"What time would you like to meet?", 1:"At what time would you be available?", 2:"For which time should I book the appointment?"},
};

const uniquecounters = {
  getIntent: 0,
  getPerson: 0,
  getDay: 0,
  getWholeDay: 0,
  getTime: 0,
  getConfirm: 0,
};

/* Helper functions */
function asBoolean(utterance) {
  return (confirm[utterance.toLowerCase()] || {}).bool;
}

function hasBoolean(utterance) {
  return utterance.toLowerCase() in confirm;
}

function isFamousPerson(utterance) {
  return utterance in infobox;
}

function getInfoOn(utterance) {
  return (infobox[utterance] || {}).info;
}

function getHelpFor(topic) {
  return (helpbox[topic].text);
}

function fetchCategoryEntity(entityArray, categ) {
  for (let i in entityArray) {
    if (entityArray[i].category == categ) {
      return entityArray[i];
    }
  }
}

function randPrompt(currentState) {
  return (promptbox[currentState][Math.floor(Math.random() * 3)]);
}

function resetCounts(){
  for (let i in uniquecounters){
    uniquecounters[i] = 0
  }
}

function overrideConfidence(prev){
  prev.value[0].confidence = 1
  console.log('override func', prev.value[0].confidence)
}

const dmMachine = setup({
  guards: {
    isNegation: ({ event }) => {
      return hasBoolean(event.value[0].utterance);
    },
    meetingIntent: ({ context }) => {
      return context.prevEvent.nluValue.topIntent == "Create a meeting";
    },

    whoIsXIntent: ({ context }) => {
      return (context.prevEvent.nluValue.topIntent == "Who is X")
    },

    noEntity: ({ context }) => {
      return (context.prevEvent.nluValue.entities == (0))
    },   

    isFamous: ({ context }) => {
      return (isFamousPerson(context.prevEvent.nluValue.entities[0].text))
    },

    hasCategory: ({ context }, params) => {
      const categs = [];
        for (let i in context.prevEvent.nluValue.entities) {
          categs.push(context.prevEvent.nluValue.entities[i].category)
        };
        if (categs.includes(params)) {
          return true;
        } else {
          return false;
        }
    },

    askingForHelp: ({ context }) => {
      return (context.prevEvent.nluValue.topIntent == "Help needed");
    },

    containsHelp: ({ context }) => {
      return (context.prevEvent.value[0].utterance.includes("help") || context.prevEvent.value[0].utterance.includes("Help"));
    },

    confidenceLow: ({ context }) => {
      return (context.prevEvent.value[0].confidence < 0.7)
    },

  },

  actions: {
        /* define your actions here */
    notInGrammar: ({ context }, params) => 
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: `Sorry, ${
            context.prevEvent.value[0].utterance
          } is ${ params }.`,
        },
      }),

    say: ({ context }, params) =>
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: params,
        },
      }),

    sayIntro: ({ context }, params) =>
    context.ssRef.send({
      type: "SPEAK",
      value: {
        utterance: ` ${ randPrompt(params) } `,
        }
    }),

    listen: ({ context }) =>
      context.ssRef.send({
        type: "LISTEN",
      }),

    nluListen: ({ context }) =>
      context.ssRef.send({
        type: "LISTEN",
        value: { nlu: true } /** Local activation of NLU */,
      }),

    upCounter: ({ context }, params) =>
     uniquecounters[params] = uniquecounters[params] + 1,

    reset: ({ context }) =>
     resetCounts(),

    upConfidence: ({ context }) =>
     overrideConfidence(context.prevEvent),

  },

}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBECyBiAggZQEoH0A5AeQElCAFAVQBUBtABgF1FQAHAe1gEsAXbjgDtWIAB6IALACYANCACeiAIwB2JQDYAdAFYJADm0BmCUb3r1KgL6W5aTYQ6lBbAK69svAIa8w6bBQBRTABpfABhYlQKABkAmgDGFiQQTh5+IRFxBAkGKU0lPRUJCXVtNQBOMsMVOUUEVUNtfMMCw2rciXK9a1tUe0dnNw9vX38g0Iio2Pi6JST2Lj4BYWSs7SklfMqpbXVO7SMJQ1rEbT0JTWly-UK9BgK1HpA7AAkwABs2YZ8-QJDwyIxOIJZgiVJLDKrSQSFRaWFGDQMHIFWQKRCGKTqBiaTH6HLlBjaBjEwxPOzRDgAdzCQgAZtwIGBBABjUZ-CaA6Yg+YpRbpFagLL6MqaDH3BjlJQIqXaE4INqSy57bbqPTlCwlMl9GmCekAJwAtrgwGx0LgAhEAOKEUjYALIRJgvnLTKIc6bdSqJRScqGPQFEyoupKFqacrhrr6Ykbb1SLWaHX6o0ms0W4jW2322Y88H810IPShz1qH1+gPrOX+y4R3YMNRKBiGJHxih6k2eNtYPA0GjYfDmzDIACajuSuZdUIQUmJYaMdbMdZUDEKcqllU0Ki6uwafvWVhszz6AHVPHwaBxhnreOgwtFSGFgqOFmkJ4LThstutdvtDsc0fVtHXTcDGLNoDCkfdek0VsOANNheEwQQIEwWAAGtoL1WD4N+cYASmYEn15F9ITfepGwuTEDiOENfRhP86l9TYckA6RcibPQOJbTC4IQpCUPQy0wF4JwfEEXhNH4kSmWvMZ-kmIEZlBMdnRIsRlGKD0chhFQmwkBtclXJQpU0OsdnKFQyixNRugPOwYJ4xDkLQzRBOEsTpM0aJuFgUSADEOD1KSxNTK0bTtB0lOfCEBTU+o9B2Ey-UlQxGJJGp-wbco8glLESnuFL7kgw8MKw3inIEoSgvEsIAAswGZVCqvQQjx1UoV9DhUoWly+54rlYxcg3ZVETOIxtC40rHP4lzKvcsSEzqhqmuzJ1iJi9rMSGhEepROVMUbEyspA251QkCaHL45zXKqhb6saubrzoKQcxU9bEA2ToTJKdRfSKIzPUM1RRSkXECmuMzSVsvp7Pgqartm0TqsW+7EeawwXrW-MdhB-JVGjT0pGMJQ5U3cowx9ExzixIkdnO2HLoqtzEdupaHuaiQMeirGjDyIyl1yAmidXQm9E0an-XMqV1D9Iq7O4+nypmpmPNqu7lu0Tm80nHYMVx-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-6JI-EHCNhkK0KAl3FtIcCNGVobidCVCTzTiPK2L1or6VDfLOHGBNIgqYDgrcCQowpt506TgcRCKYHG4SLBimCigSzd4EhZSsHE5KzMov5tB5CZr4i6CPIHAQI3zaGFA3zXBdAtCxbro6IoGMoClBFZBgTYgikShik7ClGIhkziqgKEyX4pHybFaMzPr85qo1Qap1D0n6phE4hlBEjhjYm2rmr6DEbJIgzsQ-TNjXYKpdpRo0on7QLVi46A7XwWK0EJrmBmCtCzqeixZLaCnSAMFPI6klB6mGSlIEiAS2p+g5DjopmYZKoPHsaob2n4b8YKhankZZnin6kQQXDMSpIOLjy36Bn5rIaVlWl+KCCpnqnoi0bOlFBWK6QcTCyFACHGGFj-KVBdbxZoFtAG4lg8Em4jzX44jKhEhj60zdlIbdb8ROZoFVjcFYGbkpoaDn43omlriNKHnLrdYuannDn1ApJhhZSooXZRbjqDLxQ5bAaVF5xLmqY9aqZgn3BYmynJSEgbBmaoo7mj5ExnCT6Q7MJ3ZgBLYw7iHEgYHrmXmsnvTRmnbXzXBMF4hzZYUPZk6NENh5DmTmD47K4iZTiwJiyBiNo5BPJmBNKk7wRC4GiNGtGJQuE+i5BiLHYFCihGTXCoomCSgHJQRq6CB0k1mDZr7dEkj9EZ79RGC8o4nhg3yqhjrWDWBAA */
  context: {
    noInputCount: 0,
    who: '',
    day: '',
    time: '',
    infotext: '',
    helptext: '',

  },
  id: "DM",
  initial: "Prepare",
  on: { ASR_NOINPUT: ".NoInputState" },
  states: {
    NoInputState: { 
      entry: [{
        type: "upCounter",
        params: ({ context }) => {
          return context.current;
        }
      }, {
        type: "sayIntro",
        params: "NoInputState"
      }],
      on: { 
        SPEAK_COMPLETE: [{
          guard: ({ context }) => uniquecounters[context.current] < 3,
          target: "#DM.PromptAndAsk.hist"
        }, {
          target: "#DM.Done",
          actions: {
            type: "say",
            params: "It seems no one's here."
          }
        }]
      }
    },
    HelpState: {
      entry: [{
        type: "say",
        params: ({ context }) => {
          return ` ${ context.helptext } `;
        }
      }],
      on: { SPEAK_COMPLETE: "#DM.PromptAndAsk.hist" },
    },
    LowConfidence: {
      entry: [{
        type: "say",
        params: ({ context }) => {
          return `Did you say: ${ context.prevEvent.value[0].utterance } ?`;
        }
      }],
      on : {SPEAK_COMPLETE: "ConfirmRep"}
    },
    ConfirmRep: {
      entry: "nluListen",
      on: {
        RECOGNISED: [{
          guard: ({ event }) => asBoolean(event.value[0].utterance),
          target: "#DM.PromptAndAsk.deephist",
          actions: [
            "upConfidence",
            raise({ type: "RECOGNISED" })
          ]
        }, { 
          target: "#DM.PromptAndAsk.hist" 
        }]
      }
    },
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
      after: {
        7000:  "PromptAndAsk",
      },
      on: {
        CLICK: "PromptAndAsk",
      },
    },
    PromptAndAsk: {
      initial: "Prompt",
      states: {
        hist: {
          type: "history",
          reenter: true
        },
        deephist: {
          type: "history",
          history: "deep"
        },
        Prompt: {
          entry: [{
            type: "say",
            params: `Hello!`,
          }],
          on: { SPEAK_COMPLETE: "GetIntent" },
        },
        GetIntent: {
          entry:
            assign ({
              current: ({ context }) => "getIntent"
            }),
          initial: "AskIntent",
          states: {
            AskIntent: {
              entry: {
                type: "sayIntro",
                params: "GetIntent"
              },
              on: { SPEAK_COMPLETE: "ListenForIntent" }
            },
            ListenForIntent: {
              entry: "nluListen",
              on: { 
                RECOGNISED: {
                  target: "CheckIntent",
                  actions: assign({
                    prevEvent: ({context, event }) => event
                  })
                }
              }
            },
            CheckIntent: {
              // for part 2.3) this would be the section to implement a confidence
              // threshold for nlu. analogue to the guard and the listen+check
              // states for ASR; a something similar could be created to verify if 
              // the confidence value for the topIntent in nluValue is above a given
              // threshold. If below, verbal confirmation is requested (as in LowConfidence
              // state), and if rejected the initial AskIntent question is re-raised.
              // Might be useful, if for example the user's need to for help should always
              // be listened for via an intent (I found this to be bothersome later on, as 
              // one-word answers often got mistaken for a 'help' request, so I settled for
              // substring searches in this case.)
              always: [{
                guard: "confidenceLow",
                target: "#DM.LowConfidence",
              }, {
                guard: "askingForHelp",
                target: "#DM.HelpState",
                actions: assign({
                  helptext: ({ context }) => getHelpFor("Intents")
                }),
              }, {
                guard: and(["whoIsXIntent", "noEntity"]),
                target: "IntentConfusion",
              }, {
                guard: and(["whoIsXIntent", "isFamous"]),
                target: "#DM.PromptAndAsk.WhoIsX",
                actions: assign({
                  infotext: ({ context }) => getInfoOn(context.prevEvent.nluValue.entities[0].text),
                }),
              }, {
                guard: and(["meetingIntent", "noEntity"]),
                target: "#DM.PromptAndAsk.CheckMeetingStatus",
              }, { 
                guard: "meetingIntent",
                target: "#DM.PromptAndAsk.CheckMeetingStatus",
                actions: 
                  enqueueActions(({ enqueue, check, context }) => {
                    if (check({ type: "hasCategory", params: "Meeting Person" })) {
                      enqueue.assign({
                        who: fetchCategoryEntity(context.prevEvent.nluValue.entities,
                          "Meeting Person").extraInformation[0].key
                      });
                    }
                    if (check({ type: "hasCategory", params: "Meeting Day" })) {
                      enqueue.assign({
                        day: fetchCategoryEntity(context.prevEvent.nluValue.entities,
                          "Meeting Day").text
                      });
                    }
                    if (check({ type: "hasCategory", params: "Meeting Time" })) {
                      enqueue.assign({
                      time: fetchCategoryEntity(context.prevEvent.nluValue.entities,
                        "Meeting Time").extraInformation[0].key
                      });
                    }
                  })
              }, {
                target: "IntentConfusion"
              }]
            },
            IntentConfusion: {
              entry:[{
                type: "say",
                params: `I'm unsure what you want to do.`
              }],
              on: {
                SPEAK_COMPLETE: {
                  target: "#DM.HelpState",
                  actions: assign({
                    helptext: ({ context }) => getHelpFor("Intents")
                  })
                }
              }
            }
          }
        },
        WhoIsX: {
          entry: [{
            type: "say",
            params: ({ context }) => {
              return `Here's what I know: ${ context.infotext } `;
            }
          }],
          on: { SPEAK_COMPLETE: "#DM.Done" },
        },  
        CheckMeetingStatus: {
          entry: [
            assign ({
              current: ({ context }) => 'getIntent'
            }), {
            type: "sayIntro",
            params: "CheckMeetingStatus"
          }],
          on: {
            SPEAK_COMPLETE: [{
              guard: ({ context }) => context.who === '',
              target: "#DM.PromptAndAsk.AskPerson"
            }, {
              guard: ({ context}) => context.day === '',
              target: "GetDay"
            }, {
              guard: ({ context }) => context.time === '',
              target: "#DM.PromptAndAsk.GetWholeDay"
            }, {
              target: "CreateTimeAppt"
            }]
          }
        },
        AskPerson: {
          initial: "AskWho",
          states: {
            AskWho: {
              entry: [
                assign ({
                 current: ({ context }) => "getPerson"
              }), {
                type: "sayIntro",
                params: "GetPerson",
              }],
              on: { SPEAK_COMPLETE: "ListenWho" },
            },
            ListenWho: {
              entry: "nluListen",
              on: {
                RECOGNISED: {
                  target: "CheckWho",
                  actions: assign({
                    prevEvent: ({ context, event }) => event
                  })
                }
              }
            },
            CheckWho: {
              always: [{
                guard: "confidenceLow",
                target: "#DM.LowConfidence"
              }, {
                guard: "containsHelp",
                target: "#DM.HelpState",
                actions: assign({
                  helptext: ({ context }) => getHelpFor("Meeting")
                })
              }, {
                guard: { type: "hasCategory", params: "Meeting Person" },
                target: "#DM.PromptAndAsk.CheckMeetingStatus",
                actions: assign({
                  who: ({ context }) => fetchCategoryEntity(context.prevEvent.nluValue.entities,
                    "Meeting Person").extraInformation[0].key
                })
              }, {
                target: "#DM.PromptAndAsk.NotAvailable",
              }]
            }
          }
        },
        NotAvailable: {
          entry: [{
            type: "notInGrammar",
            params: "not available"
          }],
          on : { SPEAK_COMPLETE: "#DM.PromptAndAsk.AskPerson" }
        },
        GetDay: {
          initial: "AskWhichDay",
          states: {
            AskWhichDay: {
              entry: [
                assign ({
                  current: ({ context }) => "getDay"
               }), {
                type: "sayIntro",
                params: "GetDay"
              }],
              on: { SPEAK_COMPLETE: "ListenWhichday" }
            },
            ListenWhichday: {
              entry: "nluListen",
              on: {
                RECOGNISED: {
                  target: "CheckDay",
                  actions: assign({
                    prevEvent: ({ context, event }) => event
                  })
                }
              }
            },
            CheckDay: {
              always: [{
                guard: "confidenceLow",
                target: "#DM.LowConfidence"
              }, {
                guard: "containsHelp",
                target: "#DM.HelpState",
                actions: assign({
                  helptext: ({ context }) => getHelpFor("Meeting")
                })
              }, {
                guard: { type: "hasCategory", params: "Meeting Day" },
                target: "#DM.PromptAndAsk.CheckMeetingStatus",
                actions: assign({
                  day: ({ context }) => fetchCategoryEntity(context.prevEvent.nluValue.entities,
                    "Meeting Day").text
                  })
              }, {
                target: "AskWhichDay",
                actions:{
                  type: "notInGrammar",
                  params: "not a valid day"
                }
              }]
            }
          }
        },
        GetWholeDay: {
          initial : "AskWholeDay",
          states: {
            AskWholeDay: {
              entry: [
                assign ({
                  current: ({ context }) => "getWholeDay"
               }), {
                type: "sayIntro",
                params: "GetWholeDay"   
              }],
              on: { SPEAK_COMPLETE: "ListenWholeDay" },
            },
            ListenWholeDay: {
              entry: "listen",
              on: {
                RECOGNISED: [{
                  guard: ({ event }) => asBoolean(event.value[0].utterance),
                  target: "#DM.PromptAndAsk.CreateWholeDayAppt"
                }, {
                  guard: "isNegation",
                  target: "#DM.PromptAndAsk.GetTime"
                }, {
                  target: "#DM.HelpState",
                  actions: assign({
                    helptext: ({ context }) => getHelpFor("ConfirmQ")
                  })
                }]
              }
            }
          }
        },
        GetTime: {
          initial: "AskTime",
          states: {
            AskTime: {
              entry: [
                assign ({
                  current: ({ context }) => "getTime"
               }), {
                type: "sayIntro",
                params: "GetTime"         
              }],
                on: { SPEAK_COMPLETE: "ListenTime" }
            },
            ListenTime: {
              entry: "nluListen",
              on: {
                RECOGNISED: {
                  target: "CheckTime",
                  actions: assign({
                    prevEvent: ({ context, event }) => event
                  })
                }
              }
            },
            CheckTime: {
              always: [{
                guard: "confidenceLow",
                target: "#DM.LowConfidence"
              }, {
                guard: { type: "hasCategory", params: "Meeting Time" },
                target: "#DM.PromptAndAsk.CreateTimeAppt",
                actions:  assign({
                  time: ({ context }) => fetchCategoryEntity(context.prevEvent.nluValue.entities,
                    "Meeting Time").extraInformation[0].key
                  })
              }, {
                target: "#DM.HelpState",
                actions: assign({
                  helptext: ({ context }) => getHelpFor("Timeslots")
                })
              }]
            }
          }
        },
        CreateWholeDayAppt: {
          entry: [{
            type: "say",
            params: ({ context }) => { 
              return `Do you want me to create an appointment with ${
                context.who
              } on ${
                context.day
              } for the whole day? `;
            }
          }],
          on: { SPEAK_COMPLETE: "ListenApptConfirm" },
        },
        CreateTimeAppt: {
          entry: [{
            type: "say",
            params: ({ context }) => { 
              return `Would you like to create an appointment with ${
                context.who
              } on ${
                context.day
              } at ${
                context.time
              } ? `;
            }
          }],
          on: { SPEAK_COMPLETE: "ListenApptConfirm" }
        },
        ListenApptConfirm: {
          entry: [
            assign ({
              current: ({ context }) => "getConfirm"
           }), {
            type: "listen"
          }],
          on: { 
            RECOGNISED: [{
              guard: ({ event }) => asBoolean(event.value[0].utterance),
              target: "#DM.Done",
              actions: [{
                type: "say",
                params: `Thank you, your appointment has been created!`
                }]
            }, {
              guard: "isNegation",
              target: "#DM.Done"
            }, {
              target: "#DM.HelpState",
              actions: assign({
                helptext: ({ context }) => getHelpFor("ConfirmQ")
              })
            }]
          }
        }
      }
    },
    Done: {
      entry: [
        "reset",
        assign ({
          who: ({ context }) => ''
        }), 
        assign ({
          day: ({ context }) => ''
        }),
        assign ({
          time: ({ context }) => ''
        })
      ],
      on: {
        CLICK: "PromptAndAsk",
      }
    }
  }
},
);

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
