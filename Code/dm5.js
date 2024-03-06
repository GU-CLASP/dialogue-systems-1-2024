import { assign, createActor, enqueueActions, setup } from "xstate";
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
  "Billie Eilish" : {info: "Billie Eilish is an American singer and songwriter."},
  "Rosa Parks" : {info: "Rosa Parks was an integral activist in the civil rights movement in America"}
};

const helpbox = {
  "Intents": {text: "You can either book an appointment or ask about one of these famous people: Billie Eilish, Christopher Nolan, Rosa Parks."},
  "Meeting": {text: "You can meet with Christine Howes, Rasmus Blanck or Vladislav Maraev on weekdays either at a specific time, or for the whole day."},
  "ConfirmQ": {text: "Please reply with yes or no."},
  "Timeslots" : {text: "You can book meetings at full hours from 8am to 4pm."}
};

const promptbox = {
  "NoInputState": {1:"I didn't hear you.", 2:"Sorry, I didnt get that.", 3:"I didn't catch that."},
  "GetIntent": {0:"How can I help you?", 1:"What can I help you with?", 2:"What can I do for you?"},
  "CheckMeetingStatus": {0:"Let's see:", 1:"Alright:", 2:"Ok:"},
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

const dmMachine = setup({
  guards: {
    isNegation: ({ event }) => {
      return hasBoolean(event.value[0].utterance);
    },

    meetingIntent: ({ event }) => {
      return event.nluValue.topIntent == "Create a meeting";
    },
    
    whosIsX_FamousPerson: ({ event }) => {
      return ((event.nluValue.topIntent == "Who is X")
      && isFamousPerson(event.nluValue.entities[0].text));
    },

    whoIsXIntent_noEntity: ({ event }) => {
      return ((event.nluValue.topIntent == "Who is X")
      && (event.nluValue.entities == (0)));
    },

    hasCategory: ({ event }, params) => {
      const categs = [];
        for (let i in event.nluValue.entities) {
          categs.push(event.nluValue.entities[i].category)
        };
        if (categs.includes(params)) {
          return true;
        } else {
          return false;
        }
    },

    // collect: ({ context, event }) => {
    //   for (let i in event.nluValue.entities) {
    //     const categ = event.nluValue.entities[i].category
    //     context.categ = event.nluValue.entities[i]
    //   }
    // },

    meetingIntent_noEntity: ({ event }) => {
      return ((event.nluValue.topIntent == "Create a meeting") && (event.nluValue.entities == (0)));
    },

    askingForHelp: ({ event }) => {
      return (event.nluValue.topIntent == "Help needed");
    },

    containsHelp: ({ event }) => {
      return (event.value[0].utterance.includes("help")||event.value[0].utterance.includes("Help"));
    },

    confidenceLow: ({ event }) => {
      return (event.value[0].confidence < 0.5)
    },


  },

  actions: {
        /* define your actions here */
    notInGrammar: ({ context, event }, params) => 
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: `Sorry, ${
            event.value[0].utterance
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


  },

}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBECyBiAggZQEoH0A5AeQElCAFAVQBUBtABgF1FQAHAe1gEsAXbjgDtWIAB6IALACYANCACeiAIwAOCQDYAdAE4GK7Sv0MpAVglmAvhblpNhDqUFsArr2y8AhrzDpsFAKKYANL4AMLEqBQAMv40-owsSCCcPPxCIuIIAMzq2prqKgDsEkUGSuZ6WXKKCKpSWTra9VIM6kqtJoVZVjaodg5Oru5ePn6BIeGRMXF0SonsXHwCwkmZOXkFxaUq5SaV1YhZhdoNRWo5uUra6urd1iC2ABJgADZsw96+AcFhEdGx8WYIhSS3Sq0Q6gkeWMWQkhQYDBMKik6mMBwQO00UO02j2WVUhRRqh6Dz6UQ4AHdQkIAGbcCBgQQAY1G3wmf2mgPmyUWaRWoDWJiyKk0RkKhVRrRRhXRUi6Ek07SUBSyiPKahMJNs1MEdIATgBbXBgNjoXD+cIAcUIpGw-mQCWBvOWGUOwpMOnKLRUSOuEnRRxMHqyQYRGmVDCO6i1fR1+qNJrNFuI1tt9tm3JBfNd2Xdnukel9kIDKkRorMOKkEgjVcKMc0FD1Jo8TaweBoNGw+HNmGQAE1HUksy7wQgWgwdEL2toJHC5foqgplIStEpfbiEaYTMT7rYAOoePg0DjDPW8dChKKkUJBQcLVIjgWIExSJSK3FSa4FBhKdrqdFKIUVyaMU9SqusUgtNGu59AeR4np4Z7oKIsCeN4mgeDS3h6gAFPCCIAJToPuh68Mep68HePIPmCT4IC+b5XC+X6lr+rQAeKE5VvUqjKk0DDivWjYcAabC8JgggQJgsAANYNnqIliV84y-FMAJUcOtFiIghhSCBnTHFCGjbiY2gAUoUgiiGM4hhIWQ8a0QkKaJ4mSdJcmWmAvCON4gi8Jo7k+Yy55jD8kz-DMQJDs6WmZBZQGNK+TTtK+kEmOZBT5AwM57CYNxbE5imuVJsmaJ53l+cFmhRNwqGMgAYhwepBX5SZWjadoOlF96gvy2nZMYCqmD+EjZfiuLKrK25DdIsIvoS2J1jB8lFRJJUeV5LX+TVdWCI1zWVa15rtWmDpzE6NF9WsI2aMN5RjUxk1LmO8qKj+KpqiUQaFS5a3uWVm2HdttW+ftW1tSmHXplImYxVdy4IpoWS6F0v5rtoFkqABrQioB2gSuKplNKZP1iX9pXlVt1Ugw1TXg8dkOnXQWSw5dOaAYjyMCfiv6mZj5mqPkxyFEGQY4kody9Ctv1uRTgO+cDu1g0DEOpp1dASKzvXs-hSMozz6P889Fm5JokYY1kltdHluKk8V-17gAFg4sAABrKWFHLqd11Ha6OqrlLdez3Scj3-s9qrGDo5ioiceXKiGdvk3JW1xs4PBCB77JqZFWvZv7g1ByND0TeHNQokc+RfSowqRsKShJ7LcmhI7YBMjJqBgF53CCFAHzp1nqkRVyF1+3R7T6EjdnFIUhgnNcSjoiLE7wp+hIMHZNxVo362aC3bcd13-C9-3sCD+FnIZqP+d0fUrRmyoscS50pmwui6jHCBFc7I-r6QpLpJpZkybnvVu7dO7dxPmhAeoVs7DzoDDa+j5+oTzyLCI4cI57IzaEvRGLRPyQTrl0QwO9-r73AUfHufdoFn1gUPS+LMkGxUQHfLQegn4hhFicf0z1kRaA-riHmLQrimFIaVdyFAwB6lgEIAKsknYcHPl7XOTD4a1DlG+Ss+J1AMRxC+dEJQ9I4gMJZQweVqzlDEXJCRUiZGCGprtBRqsoZdTzsg66gc7qjVDqXWUqgPTow3tWPK25oJS2EjLXeNjpGyJ2r5JxDM1bpnOtFNmo4+ITi5qjXmGN6jv0jCBKEyJ5x5XQVYuRMlJExPsXExkCTkxJIdIg1JY8UG5EyfrNGfM8kRyFPkG4Gg5yoiOA3ZaETgG73sOJAAboeF4HgABGLxWQqQvt7NxzCEDFACWNPYXQjj6BlM9OUK8ik5QweGTUYznITP+uVZAHh5AVKdtwJkjsHnyCUTnEeLSb4oI3hOPZs9Zy-hjkc8uRw8g5ThB-SFL4rnhJufbOWvAPkOPiY7V5jsICPOcUzH2mk1EByGsHbx41QmyksgE0yxhH4AvxOU+5jz0V1MxW8nFnzEkuKvr89xLDVRsLpRbF+3Cl6qluiiUaAkP6-nxoyryaLamCBeey3FXKmbNJ6n8uKALNBArUBYsFlKa5YiaEcLYBgSgSHlbwBRyy0XuTtWAD5Xz4EErhuzOUeQjBQgRKLXEWNjZ5S0EKC2pgMEixUDap1iqabKudvatVDTuXurSePAoIpzZMW3CLWEZdlDBr1cjCW4aZ55WjQm51zKlUxqTSddWKStV8tqBms2xbcQ5qFBoDibRbrSBKcieuUgK0cETU8mtlaXXqvVpq322rDg3S8SXClxya5aCSgiLoTRci22uatEB5UaDcANGACpR6T2usvqm1pmRXwiz1bPO+o1lTnAAqxU1zRDGASKDa89p6lV-rxera986xyvx0ATXIwS4TpWNpCaExb2gaFyMKYde7Il3K8n+llghAPTuSRsoli7SXLqejUeykJFRbjXIO44Ub0O3NKqEJsIxa3yEwGwJSdC1kqN5Zswmb047cwOfjWUxjCmdEAnUR+ozEX7t3sxsAIw-0ca42yeh6zVHswRA0JESIP4vhrpBWQxygJaFnEGF94oQxobkxh0qSrVO8DjNwQ0QH0wgebcSouIdyVkcOMqQoQtILJSDMiQC5THOcec7SVzBp3NnUIzmbZgmQzCdnqJiOwoGh6PUCiUs9RSxLTs4xuSUWxIubc-hppSWC6eJIz4ld5GBJvg3QUEowKjjlMqwaLwywqDMmWS2S9mm+NqOuBOAk24DBx2KGZCOFkJxQkkxPKl5h6zICED4S815byef44jacaX9kZfBYcW4CpUTBxa6iTeVh7iCA4AyeASQ0BadHAAWnzQgL7ZsET-YB-9zo9Z7COBcG4NCYB3u33aCBdBs8u1SfmzUPGQXdCHOOPlme9ZnhvA+FDsbOYrYTgxgWH0+hizHKFB6PY2UMsYwK-WckVJYsMmZATptmzif5m9EWHh5cgKMXeqqICLQuj1h68aNg0P+oYKWwTCW2CbiLnI4Sb1FYXxyi3mEwBjZmxNhl5kaQAF2mKnXLORaJDlpwTIghFsvBDeHExNxK4iJIz3W+4BFE+R1y0+o-RkryKZKO4QJsVLeyraHLfQ0KsOJZyviKFcXdgfk6aExahEPy9w-paj8bWeJOzVerlOKWTuukWp4ZCadPDvCejmKJN3ZOfMso7UJopollZrmGkOU8ZNfOdqOttnk7ueUftGDKZCzqpLIhh17YXvqfKZAxD+0CUU8I1YIXtjJEgnqzfhyNWAPZf5OYYqgrCpW1l8WQVPDzBC5N-G12FlGcn5LZPutQxoPANT9VSVcrBWy+4RdNH0BJTAoRi1zJzAn9pATh7JVRZxykFFSA3Zl9xxFQgJkQN5RdBoxNP4cogx4RAttxylU5aR05kFCUcx8E8gNBSg4Qfw6hPcqw2FENXxi0URuswFD5IFqEvB04Q8WgZwzY1xBcRFzATMaguguJjANxSxkp9Bylok7Fl9pU18Z4N8cEI5CRTUDBDBp47I5UP9U9FDZFHVnZL8qxVDb954NCahzAoUcQa4ih44bgFDZIqk7EcMFEACugH0MDCQKxhQzsEA7DGgDBAjnDZ8+h58QEplMBZluB5klkOc51m0rgdFFRIQOZrJcQDAAxAI+18ZwIcZ6hisj97MNpUVHkQ8jMh9I9m8WEmJEp98F5-FIigFP8mUnlTCsUPlqjSxaiRMgiQstAzEJ9ERt0EUyjSsv9Y1HE2VsUqja9x58QPRLILJ6gdFQxZxKUcQkYfQkR1hsppB38U8D0vI2NlDV8b9Z478bDlAY421ckDBjhLZD859y8zjbVJ1mVTDR0q0ah+92Yr9LCbjrDF4g07Ii0MZfwijYCR0x1PDviASUjNl1Q3wYU8trhLIqVYMUczBdNi1ji9Agdf1j1kiKD0l8YoU14ZM54kRwSUdTctFIIE5IRH5SST0z0yT+DjA0caS2g6SdgOJZ4P1sFdBIISgOT-040-1+DzUMjjjRYKgBJhSRQoRIIFpaNJj3jj8mMWNvA2MnNl9uF+kCxQ4Wg9hA08TITQ0vRRpSw-Vut9SwAVNotqjxUjsI9BjZQUMsQu9IQhRDJIs40nMesUCywpMMC4RFsqwAxCw-TzEZwO02hutYtDQ+shABsmQhs9RM8gwBjTs4z8ZTVOga4E4VjtS+hNtBBySPV-YuYedCwKd+cAsThTUjBDBcgdh4D7sgA */
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
        type: "upCounter", params: ({ context}) => {
          return context.current;
        }
      },
        // ({ context }) => {
        //   console.log(context.noInputCount, context.current, uniquecounters[context.current]);
        // }, 
        {
          type: "say",
          params: ({ context }) => {
            return ` ${ promptbox["NoInputState"][uniquecounters[context.current]] } `;
          }
        },
      ],
      on: { 
        SPEAK_COMPLETE:[{
          guard: ({ context }) => uniquecounters[context.current] < 3,
          target: "#DM.PromptAndAsk.hist",
        }, {
          target: "#DM.Done",
          actions: {
            type: "say",
            params: "It seems no one's here"
          }
        }]
      },
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
      params: ({ event }) => {
        return `Did you say: ${ event.value[0].utterance } ?`;
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
      }, {
        target: "#DM.PromptAndAsk.hist",
      },
    ]
   },
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
      // after: {
      //   7000:  "PromptAndAsk",
      // },
      on: {
        CLICK: "PromptAndAsk",
      },
    },
    PromptAndAsk: {
      initial: "Prompt",
      states: {
        hist: {
          type: "history",
          reenter: true,
        },
        deephist: {
          type: "history",
          history: "deep",
          reenter: true,
        },
        Prompt: {
          entry: [{
            type: "say",
            params: `Hello!`,
          }],
          on: { SPEAK_COMPLETE: "GetIntent" },
        },

        GetIntent: {
          entry: [
            assign ({
              current: ({ context }) => 'getIntent'
            })
          ],
          initial: "AskIntent",
          states: {
            AskIntent: {
              entry: [{
                type: "sayIntro",
                params: "GetIntent",                
              }],
              on: { SPEAK_COMPLETE: "ListenForIntent" },
            },
            ListenForIntent: {
              entry: "nluListen",
              on: {
                RECOGNISED: [
                 {
                  guard: "askingForHelp",
                  target: "#DM.HelpState",
                  actions: assign({
                    helptext: ({ context }) => getHelpFor("Intents")
                  }),
                
                }, {
                  guard: "confidenceLow",
                  target: "#DM.LowConfidence",
                 // actions: {type: "say", params: "Sorry, could you repeat that?"}
                }, {
                  guard: "whoIsXIntent_noEntity",
                  target: "IntentConfusion",
                }, {
                  guard: "whosIsX_FamousPerson",
                  target: "#DM.PromptAndAsk.WhoIsX",
                  actions: assign({
                    infotext: ({ event }) => getInfoOn(event.nluValue.entities[0].text),
                  }),
                }, {
                  guard: "meetingIntent_noEntity",
                  target: "#DM.PromptAndAsk.CheckMeetingStatus",
                }, {
                  guard: "meetingIntent",
                  target: "#DM.PromptAndAsk.CheckMeetingStatus",
                  actions: [    
                    enqueueActions(({ enqueue, check, event }) => {
                      if (check({ type: "hasCategory", params: "Meeting Person" })) {
                        enqueue.assign({
                          who: fetchCategoryEntity(event.nluValue.entities,
                            "Meeting Person").extraInformation[0].key
                        });
                      }
                    }),
                    enqueueActions(({ enqueue, check, event }) => {
                      if (check({ type: "hasCategory", params: "Meeting Day" })) {
                        enqueue.assign({
                          day: fetchCategoryEntity(event.nluValue.entities,
                            "Meeting Day").text
                        });
                      }
                    }),
                    enqueueActions(({ enqueue, check, event }) => {
                      if (check({ type: "hasCategory", params: "Meeting Time" })) {
                        enqueue.assign({
                        time: fetchCategoryEntity(event.nluValue.entities,
                          "Meeting Time").extraInformation[0].key
                      });
                    }})
                  ]
                }, {
                  target: "IntentConfusion",
                }],
              },
            },
            IntentConfusion: {
              entry:[{
                type: "say",
                params: `I'm unsure what you want to do.`
              }],
              on: {
                SPEAK_COMPLETE: {
                  target: "#DM.HelpState",
                  actions:  assign({
                    helptext: ({ context }) => getHelpFor("Intents")
                  })
                }
              }
            },
          },
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
            params: "CheckMeetingStatus",
          }],
          on: {
            SPEAK_COMPLETE: [{
              guard: ({ context }) => context.who === '',
              target: '#DM.PromptAndAsk.AskPerson',
            }, {
              guard: ({ context}) => context.day === '',
              target:"GetDay",
            }, {
              guard: ({ context }) => context.time === '',
              target: "#DM.PromptAndAsk.GetWholeDay",
            }, {
              target: "CreateTimeAppt",
            }]
          }
        },
        AskPerson: {
          initial: "AskWho",
          states: {
            AskWho: {
              entry: [
                assign ({
                 current: ({ context }) => 'getPerson'
              }), {
                type: "sayIntro",
                params: "GetPerson",
              }],
              on: { SPEAK_COMPLETE: "ListenWho" },
            },
            ListenWho: {
              entry: "nluListen",
              on: {
                RECOGNISED: [{
                    guard: "containsHelp",
                    target: "#DM.HelpState",
                    actions: assign({
                      helptext: ({ context }) => getHelpFor("Meeting")
                    })
                },{
                  guard: { type: "hasCategory", params: "Meeting Person" },
                  target: "#DM.PromptAndAsk.CheckMeetingStatus",
                  actions: assign({
                    who: ({ event }) => fetchCategoryEntity(event.nluValue.entities,
                      "Meeting Person").extraInformation[0].key
                  }),
                }, {
                  target: "#DM.PromptAndAsk.NotAvailable",
                }],
              },
            },
          },
        },
        NotAvailable: {
          entry: [{
            type: "notInGrammar",
            params: "not available",
          }],
          on : { SPEAK_COMPLETE: "#DM.PromptAndAsk.AskPerson" }
        },
        GetDay: {
          initial: "AskWhichDay",
          states: {
            AskWhichDay: {
              entry: [
                assign ({
                  current: ({ context }) => 'getDay'
               }), {
                type: "sayIntro",
                params: "GetDay",
              }],
              on: { SPEAK_COMPLETE: "ListenWhichday" },
            },
            ListenWhichday: {
              entry: "nluListen",
              on: {
                RECOGNISED: [{
                  guard: "containsHelp",
                  target: "#DM.HelpState",
                  actions: assign({
                    helptext: ({ context }) => getHelpFor("Meeting")
                  })
                }, {
                  guard: { type: "hasCategory", params: "Meeting Day" },
                  target: "#DM.PromptAndAsk.CheckMeetingStatus",
                  actions: assign({
                    day: ({ event }) => fetchCategoryEntity(event.nluValue.entities,
                      "Meeting Day").text
                    }),
                }, {
                  target: "AskWhichDay",
                  actions:{
                    type: "notInGrammar",
                    params: "not a valid day",
                  },
                }],
              },
            },
          },
        },
        GetWholeDay: {
          initial : "AskWholeDay",
          states: {
            AskWholeDay: {
              entry: [
                assign ({
                  current: ({ context }) => 'getWholeDay'
               }), {
                type: "sayIntro",
                params: "GetWholeDay",    
              }],
              on: { SPEAK_COMPLETE: "ListenWholeDay" },
            },
            ListenWholeDay: {
              entry: "listen",
              on: {
                RECOGNISED: [{
                  guard: ({ event }) => asBoolean(event.value[0].utterance),
                  target: "#DM.PromptAndAsk.CreateWholeDayAppt",
                }, {
                  guard: "isNegation",
                  target: "#DM.PromptAndAsk.GetTime",
                }, {
                  target: "#DM.HelpState",
                  actions: assign({
                    helptext: ({ context }) => getHelpFor("ConfirmQ")
                  })
                }],
              },
            },
          },
        },
        GetTime: {
          initial: "AskTime",
          states: {
            AskTime: {
              entry: [
                assign ({
                  current: ({ context }) => 'getTime'
               }), {
                type: "sayIntro",
                params: "GetTime",             
              }],
                on: { SPEAK_COMPLETE: "ListenTime" },
            },    
            ListenTime: {
              entry: "nluListen",
              on: {
                RECOGNISED: [
                     {
                  guard: { type: "hasCategory", params: "Meeting Time" },
                  target: "#DM.PromptAndAsk.CreateTimeAppt",
                  actions:  assign({
                    time: ({ event }) => fetchCategoryEntity(event.nluValue.entities,
                      "Meeting Time").extraInformation[0].key
                    }),
                }, {
                  
                    target: "#DM.HelpState",
                    actions: assign({
                      helptext: ({ context }) => getHelpFor("Timeslots")
                    })
                  
                }],
              },
            },
          },
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
            },
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
            },
          }],
            on: { SPEAK_COMPLETE: "ListenApptConfirm" }
        },
        ListenApptConfirm: {
          entry: [
            assign ({
              current: ({ context }) => 'getConfirm'
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
                }],
            }, {
              guard: "isNegation",
              target: "#DM.PromptAndAsk.GetIntent",
              reenter: true,
              actions: [
                assign({ who: '' }),
                assign({ day: '' }),
                assign({ time: '' }),
              ]
            }, {
              target: "#DM.HelpState",
              actions: assign({
                helptext: ({ context }) => getHelpFor("ConfirmQ")
              })
            }],
          },
        },
        ConfirmationUnclear: {
          entry: [{
            type: "say",
            params: ({ event }) => { 
              return `Sorry, ${ event.value[0].utterance 
              } is not a clear confirmation nor negation. Please answer with Yes or No. `;
          }}],
          on: {SPEAK_COMPLETE: "ListenApptConfirm"}
        },
     },
    },
    Done: {
      entry: [
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
