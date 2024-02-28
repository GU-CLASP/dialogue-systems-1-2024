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
const grammar = {
  // vlad: { person: "Vladislav Maraev" },
  // aya: { person: "Nayat Astaiza Soriano" },
  // rasmus: { person: "Rasmus Blanck" },
  // staffan: { person: "Staffan Larsson" },
  // chris: { person: "Christine Howes" },
  // monday: { day: "Monday" },
  // tuesday: { day: "Tuesday" },
  // wednesday: { day: "Wednesday" },
  // thursday: { day: "Thursday" },
  // friday: { day: "Friday" },
  // "8": { time: "8:00" },
  // "9": { time: "9:00" },
  // "10": { time: "10:00" },
  // "11": { time: "11:00" },
  // "12": { time: "12:00" },
  // "noon": { time: "12 pm" },
  // "1": { time: "1 pm" },
  // "2": { time: "2 pm" },
  // "3": { time: "3 pm" },
  // "4": { time: "4 pm" },
};

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
  "Billie Eilish" : {info : "Billie Eilish is an American singer and songwriter."},
  "Rosa Parks" : {info : "Rosa Parks was an integral activist in the civil rights movement in America"}
};

/* Helper functions */
function isInGrammar(utterance) {
  return utterance.toLowerCase() in grammar;
}

function getPerson(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).person;
}

function getTime(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).time;
}

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


/// cont here 

function fetchCategoryEntity(entityArray, categ) {
  for (let i in entityArray) {
    if (entityArray[i].category == categ) {
      return entityArray[i];
    }
  }
}


const dmMachine = setup({
  guards: { //somehow pass last utterance value, store in context.input?; always updated
    isPerson: ({ event }) => {
      return (isInGrammar(event.value[0].utterance) && getPerson(event.value[0].utterance));
    },

    isDay: ({ event }) => {
      //return true;
      return (isInGrammar(event.value[0].utterance) && (grammar[event.value[0].utterance.toLowerCase()] || {}).day);
    },

    isTime: ({ event }) => {
      //return true;
      return (isInGrammar(event.value[0].utterance) && (grammar[event.value[0].utterance.toLowerCase()] || {}).time);
    },

    isNegation: ({ event }) => {
      return hasBoolean(event.value[0].utterance);
    },

    
  // guards tbd: intent is meeting, intent is whoisX, entities recognised: 1 or more?; type of entity match


    whosIsXIntent: ({ event }) => {
      return event.nluValue.topIntent == "Who is X";
    },

    isFamous: ({ event }) => {
      return isFamousPerson(event.nluValue.entities[0].text);
    },

    hasEntity: ({ event }) => {
      return isFamousPerson(event.nluValue.entities[0].text)==false;
    },

    meetingIntent: ({ event }) => {
      return event.nluValue.topIntent == "Create a meeting";
    },
    
    whosIsX_FamousPerson: ({ event }) => {
      return ((event.nluValue.topIntent == "Who is X") && isFamousPerson(event.nluValue.entities[0].text));
    },

    whoIsXIntent_noEntity: ({ event }) => {
      return ((event.nluValue.topIntent == "Who is X") && (event.nluValue.entities == (0)));
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
    //return ((event.nluValue.entities !== (0)) && (event.nluValue.entities[0].category == "Meeting Person"));


    MeetingDay: ({ event }) => {
            ///iterate over entities in nlu value

      return ((event.nluValue.entities !== (0)) && (event.nluValue.entities[0].category == "Meeting Day"));
    },

    // isUnassigned: ({ context }, params) => {
    //   return (typeof(context.params) === undefined);
    // },

    meetingIntent_noEntity: ({ event }) => {
      return ((event.nluValue.topIntent == "Create a meeting") && (event.nluValue.entities == (0)));
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

    listen: ({ context }) =>
      context.ssRef.send({
        type: "LISTEN",
      }),

    nluListen : ({ context }) =>
      context.ssRef.send({
        type: "LISTEN",
        value: { nlu: true } /** Local activation of NLU */,
      }),  
  },

}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBECyBiAggZQEoH0A5AeQElCAFAVQBUBtABgF1FQAHAe1gEsAXbjgDtWIAB6IAjAHYAnAwB0EhgFYAbAGYALFO3rVADhkAaEAE9E6iZtWL1y9TI2b1DKRIC+7k2nTYKAUUwAaXwAYWJUCgAZfxp-RhYkEE4efiERcQRlKRNzBH0JeWUGEokNACYGLVUZT29UeQoAJzA2AEMWrDwaGmx8XEDkAE0EkRS+AWEkzPKJZXkZewlygok7dXKcs0ltef1lGTsJfVVVZ0O6kDR5AHU2vhoObF4O3nRQqNJQoNGk8bSpqBMvYbBJFlpylopKp7MZtggrOp1PJNqoGEprJVHJdrncHk8Xk03qJYC9eGB5G0AGbkpoACiUJQYAEp0Lj7rxHs9Xr92FwJulpogQYpwZpIdoYQ5cjt9MipND0apNgrsuUcQ1mhwALZsXiYQQQTCwADWjSaOr1vgCwTCEWisXizDG-IBGUQ+2RmisDBkMgkc3RehlCG95UUpwMUgYml95RhGvNlv1huNZoA4mBeKRBOTc-I0zm828-IEQuFIjE4rzkq7Ju6EZDw2d9JpDL6rPoQ5plOHvad1FJW0Oyj3E1rdSmjab5Jns7mwPmotxSYuAGIcJpFxdvAbhdOEUjYfzIGv-etChGnQox6O+mTizQhvSFP1v5XlbQMcqLccWycGtOGZZtuS4rnmG5bguuboHuxAHkeJ50BIiR8qkF5ApI17yLeJR+o+3Y-vImixgwnokfoUgrJof7JoBaaziB0G8PIy6roIkGgbu-j7oex6nuUqG1uhgqYVeyg3l+94EfC+zhlRpzfqoawGDGtEAamM5zlxrHgeum5cbBPHwXxSHqEJ56iWIWHKThUn4Z+IbRuGehUeUsKUYi6l6vRWlMcWunsZxzFGbxiGnpoFl1lZmRlBJdl3g5T7wpYhSaG+hyOAU37eVODE3AAFhwpCwAAGtaZZ2pWjpntFgLWQgSJtiiMhuDGlhkfo+jlCG7nRsRGwuAcGxzKouW+WaXGhEIVIAK48EIFW2hWDrVs6fx1Q2TX6C1bXOEoXXdb1EkyAsGybKOsZrOo42aWaoQFWAADGJqoGAWbcIIUDcrw81LeW9pVk6UUifVMyfjYOiQqcrVuJUqghtkyJlKcyjpf6h23UB8gPc9r3vfwX0-X9pbLYDNUoS6oMNuUEPyFDeg1AqywMAj8IBicCyKQU+xggctReFcmr-j5d0449L1vR9RNkiTNoA9V1aCVTApg4gtNqPT4qM7DLNs3kAZ6MRimyAc9gHFjDG45LBOfd9suwP9VWrfE5kq26l7QvMXswjDKiuCGZT+kU8botCLaWzOaYUGATSwEIBamoVHBOytQO1dTl6IgoKxdRJNQHDoWx5JscryAYtNSENmXxpHZrR7H8eCIFebJ6FJnhRnqsNlIyje77ag1P7xfq5+p1Uf6fcuK1ZR14nJox3HCdsa3RXtwh-HISD3dZ91NizGR9jQpR0LJSX0Knc4le3mj3o3YL1wTqL2OEBw+oAG73AANm0ABGX9gFTuTNa28PZiW2rtDEHVDo9XhKiS+51oy7BIuqB+ws6JiznMgNoph56FW4E9Aq2DTBAMVsDd2GEGoqkKG4AMElvxQ3jIHMiUgcIT2hq2MMqD6hJg0tjLBOCW6LnwYQiAOD16mVPOtNCO8xIa0htrGGzN4YhgKJocukY1RtjbP6OeAjcEr2EQVAhBUxEkLghvJClMNqZzkczemAY5hKE2NrEMfoFDKVaq2BwVRur6D0VmYheCioAOIaQl2XcwFUPsbQpxDDxRMPZhKHC7kZBykHKjKQATeBBMMYIZOoTxEWMkZEyhmRe79zUIPOQxRVAjwQLMFYCxZB8wDKzMi2Tcl6XySEsAYTimd2sTIqJ5S+70wHn7Wp9TjhnBDmiKoVdLB2G4ULXhz8GL6KET0jghTzHGUsQJUBZT1YxMcfQlxtN9aSDWKwtUnCyLxk2ALHhT88p+U5NwbUFI0w0E+YA0mCsInSOErIhqyxmouDbLfTY6xA5eJRD+OYQ1Upo2yb8r5Wz0WAIGZvYFlk1YIirqdds+hXBtR5oHQwrCajxlodYaQaK-mYr+RIwZRyYqSE-DtSF+wUFV3sJSgo9NFSVBPvDZQc9QgtDaOSApfScGYDYFaAFzt054s2lnRp9MtBImjESsiVyGnLB2q1f0iw2lon8WgtZbz7rSvJFixVyr5aqpquq2xVDKjIjOL6dGyw4UqCKPsLq3oqLHxota15E0tlOt4NNQQVJuBNG1Ky3F7KCUQJ-HtaBXVYF5BcNIcu3VBy+nUIYKMc88mxvjYm5NqarHpobA+eS6NPwkQVKzCQvVe47SvvGewrhYSVu6dWmaSaU04qQsrGxoLMjNq1n6Nt2hozKV6pRZEixsgkWqO4rJ1rkBCEAR8L4Px3WzsQHUhQPtqnD0DrTFExQw4UTOIszwgtBAcAgHAEQaAKEcoQHCPIABaMakaWjtBaH+gl2RA7nHkPsQ4vZi1yAfImPEnICSvCg1tRwKIEklCebCM+OxoTyDsIhmZZwHD3xeSLW12HLwwlYdeyZAc4GfhwkyTtlQOE0dWVGsWxjSQMbEssQtvYjiyB7ZCLscDy2KG6lmzdlg920YwdjV5ImGrRkqb7IexR6lltOijDQD4urHADNkriWnYoLM4yUDYzhXAbGUM+b0CwUbDRkLMGofHH50ejdpZi89rMzpGZIQ+9mqifhcFXdyhFL4o20J+BzPYI1qb4Rs-yO4tnBWLDZnYWgURaG0Ihnz8X4TikS6cZLpEtCorA+p-KRUSqlQKw0-2ihpD1b0GjOpxHQxEX7C+lLVQ0tzymjNealD8U0xKKwww+xmZDh7FXZ8kIPP9bUI8vrkqJb42lvbGV812tevUXUyoV0qIqVk3kNR5cr5gkRDCNSjXMtR1NIvJu7XlhFZ9VUyi6JpC3fVnU5GimHxokHD2CVb31kfYXo3BOaZk4-ZWM2WMAPowBiHN2tERbabdR7GUJQqn+MBbFg3Jezc8mo7C8cq8lh4M6E3a2GEcoQcNMVAT9HxPlKuDnq-D+38-4ANO4yBYrZUSYlS926wA1IR6AKI8vz6D3vARyTg07ahkZnD6mRf0VQ3FVC66amE4oJKyE6YIlHxjCHENO8pQolgLqhzkNYZhMYcJrHRFPZSyprcGO6SI0xWv6f-shTYbRSMqKs1c+zEoNgJIFr92UFZ-mmvvKCbbnZ8q8jDIZ-GAMEYLfRkMEodQgdAxczRL3QnsYycZ-V4xTXQf2Jyod+HjNMZjO+h1+lWMBQq-2GNrX3s1EBdw9tS3rFP3bzlzUGGAjbPA6yHUaidElFDiMlhxl+HGusXz1n13hsShFgL7OCzb8K-2aGHmEHFYeuqL1cZRivJx+C--rmBt1wcoVDDU7WmSpQ0W8xOHFGf2cElXtTAA7wVSVV4Dn2-DIxqWyAkjbS7TgSUHmFNSsAqSHGVEbzV33xxmgMdXgNOyqAUFHHcgNXFAu0FXDGUGDUQzODSQTCn2jSrXgJrXHXa17ivQmX0zYxLnXTOkhFZk-FmAkitR4QPUEDAHa3I3UW81mDBG-BcUWGOhqC5lJX-1OA1jfXcCAA */
  context: {
    noInputCount: 0,
    who: '',
    day: '',
    time: '',
    infotext: '',
  },
  id: "DM",
  initial: "Prepare",
  on: { ASR_NOINPUT: ".NoInputState" },



  states: {
    NoInputState: {
      entry: [{
        type: "say",
        params: "I didn't hear you.",
      }],
      on: { SPEAK_COMPLETE: "#DM.PromptAndAsk.hist" }
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
        },

        Prompt: {
          entry: [{
            type: "say",
            params: `Hello!`,
          }],
          on: { SPEAK_COMPLETE: "GetIntent" },
        },
        GetIntent: {
          initial: "AskIntent",
          states: {

            AskIntent: {
              entry: [{
                type: "say",
                params:`How can I help you?`,
              }],
              on: { SPEAK_COMPLETE: "ListenForIntent" },
            },

            ListenForIntent: { //TBD: guard for no entity so it doesnt break
              entry: "nluListen",
                on: {
                  RECOGNISED: [{
                    guard: "whoIsXIntent_noEntity",
                    target: "#DM.PromptAndAsk.IntentConfusion",
                  }, {
                    guard: "whosIsX_FamousPerson", //works fine now
                    target: "#DM.PromptAndAsk.WhoIsX", // who is X branch
                    actions:
                      assign({
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
                          who: fetchCategoryEntity(event.nluValue.entities, "Meeting Person").extraInformation[0].key
                        });
                      }
                    }),
                    enqueueActions(({ enqueue, check, event }) => {
                      if (check({ type: "hasCategory", params: "Meeting Day" })) {
                        enqueue.assign({
                          day: fetchCategoryEntity(event.nluValue.entities, "Meeting Day").text
                        });
                      }
                    }),
                    enqueueActions(({ enqueue, check, event }) => {
                      if (check({ type: "hasCategory", params: "Meeting Time" })) {
                        enqueue.assign({
                          time: fetchCategoryEntity(event.nluValue.entities, "Meeting Time").text
                        });
                      }})
                    ]
                  }, {
                  target: "#DM.PromptAndAsk.IntentConfusion",
                }],

                },
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
          on: { SPEAK_COMPLETE: "#DM.Done"},
        },
          
        
        IntentConfusion: {
          entry:[{
            type: "say",
            params: `Sorry, I'm unsure what you want to do. You can book an appointment or ask about one of these famous people: Billie Eilish, Christopher Nolan, Rosa Parks`
          }],
          on: { SPEAK_COMPLETE: "#DM.Done" }
        },
        
        CheckMeetingStatus: {
          entry: [{
            type: "say",
            params: "Let's see:",
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
              entry: [{
                type: "say",
                params:`Who are you meeting with?`,
              }],
              on: { SPEAK_COMPLETE: "ListenWho" },
            },

            ListenWho: {
              entry: "nluListen",
              on: {
                RECOGNISED: [{
                  guard: { type: "hasCategory", params: "Meeting Person" },
                  target: "#DM.PromptAndAsk.GetDay",
                  actions: assign({
                    who: ({ event }) => fetchCategoryEntity(event.nluValue.entities,
                      "Meeting Person").extraInformation[0].key
                    }),
                  }, {
                    target: "#DM.PromptAndAsk.NotAvailable",
                  }],
                }},
              },
            },

          NotAvailable: { //later: make sure it asks who to meet with again?
            entry: [{
              type: "notInGrammar",
              params: "not available",
            }],
            on : { SPEAK_COMPLETE: "#DM.PromptAndAsk.AskPerson" }
          },
          
       //// 
        GetDay: {
          initial: "AskWhichDay",
          states: {
            AskWhichDay: {
              entry: [{
                type: "say",
                params: ({ context }) => { 
                  return `Meeting with ${ context.who } on which day?`;
                },
              }],
              on: { SPEAK_COMPLETE: "ListenWhichday" },
            },
            ListenWhichday: {
              entry: "nluListen",
              on: {
                RECOGNISED: [{
                  guard: { type: "hasCategory", params: "Meeting Day" },
                  target: "#DM.PromptAndAsk.CheckMeetingStatus",
                  actions: assign({
                    day: ({ event }) => fetchCategoryEntity(event.nluValue.entities,
                      "Meeting Day").text
                    }),
                }, {
                  target: "AskWhichDay", //re-raise?
                  actions:[{
                    type: "notInGrammar",
                    params: "not a valid day",
                  }],
                }],
              },
            },
          },
        },
            GetWholeDay: {
              initial : "AskWholeDay",
              states: {
            AskWholeDay: {
              entry: [{
                type: "say",
                params: ({ context }) => { 
                  return `Will the meeting on ${ 
                    context.day
                  } take the whole day?`;
                },
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
                  target: "AskWholeDay", //re-raise?
                  actions:[{
                    type: "notInGrammar",
                    params: "not a clear confirmation nor negation",
                  }],
                }],
              },
            },
          },
        },
      
    
          GetTime: {
            initial: "AskTime",
            states: {
            AskTime: {
              entry: [{
                type: "say",
                params: `What time would you like to meet ?`,   
              }],
                on: { SPEAK_COMPLETE: "ListenTime" },
            },    
            ListenTime: {
              entry: "nluListen",
              on: {
                RECOGNISED: [{
                  guard: { type: "hasCategory", params: "Meeting Time" },
                  target: "#DM.PromptAndAsk.CreateTimeAppt",
                  actions:  assign({
                    time: ({ event }) => fetchCategoryEntity(event.nluValue.entities,
                      "Meeting Time").text
                    }),
                }, {
                  target: "AskTime", // re-raise?
                  actions: [{
                    type: "notInGrammar",
                    params: "not an available timeslot",
                  }],
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
              } for the whole day?`;
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
              } ?`;
            },
          }],
            on: { SPEAK_COMPLETE: "ListenApptConfirm" }
        },
        ListenApptConfirm: {
          entry: "listen",
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
              target: "#DM.PromptAndAsk.AskPerson",
              reenter: true,
            }, {
              target: "#DM.PromptAndAsk.hist",
              reenter: true,
              actions: [{
                type: "notInGrammar",
                params: "not a clear confirmation nor negation",
              }]
            }],
          },
        },
       
     },

    },
  
    Done: {
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
