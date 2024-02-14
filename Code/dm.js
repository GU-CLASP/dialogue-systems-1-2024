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
  staffan: { person: "Staffan Larsson" },
  chris: { person: "Christine Howes" },
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  wednesday: { day: "Wednesday" },
  thursday: { day: "Thursday" },
  friday: { day: "Friday" },
  "8": { time: "8:00" },
  "9": { time: "9:00" },
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  "12": { time: "12:00" },
  "noon": {time: "12 pm"},
  "1": { time: "1 pm" },
  "2": { time: "2 pm" },
  "3": { time: "3 pm" },
  "4": { time: "4 pm" },
};

const confirm = {
  yes: { bool: true },
  sure: { bool: true },
  "of course": { bool: true },
  right: { bool: true },
  yup: { bool: true },
  ja: { bool: true },
  yea: { bool: true },
  yeah: { bool: true },
  no: { bool: false},
  nope: { bool: false},
  nah: { bool: false},
  "no way": { bool: false},
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
  

const dmMachine = setup({
  guards: { //somehow pass last utterance value, store in context.input?; always updated
    inGrammar: ({ event }) => {
      //return true;
      return isInGrammar(event.value[0].utterance);
    },

    isNegation: ({ event }) => {
      return hasBoolean(event.value[0].utterance);
    },

  },

  actions: {
        /* define your actions here */
    notInGrammar: ({ context, event }) => 
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: `Sorry, ${
            event.value[0].utterance
          } ${
            isInGrammar(event.value[0].utterance) ? "is" : "is not"
          } in the grammar.`,
        },
      }),

    startListening: ({ context }) =>
      context.ssRef.send({
        type: "LISTEN",
      }),

    say: ({ context }, params) =>
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: params,
        },
      }),    
  },

}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBECyA6ACgJzABwENcBiAQQGUAlAFWvIH1KBRU5ATQG0AGAXUVDwB7WAEsALiMEA7fiAAeiAExcu6AJwBWAMwBGHV01auWgGwB2ACwAaEAE9EZgBwn05i0ZMbFTxzscBffxs0dAB1AnFqQXIxIjFiAGEAGQBJBIBpbj4kECFRCWlZBQQvHXQdQ0VtCw01LkUTG3sEJ1UqsxMtS0cNYy4zQOCMcMjo2Ox4uVhYsTB0AgAzWewACn0VLgBKYhCRsSiYuKzZPPFJGRzi0vLK6tr6xrtERyN0Mw0OjR1LRR0unUGIBCOEEAFs8GJSFIIKRYABrMhUegAOQA8ilkZgAKrUY45U4FC6gYomRyqT4mHQNNTeYyOJrPLRaN6+AxmKmKRQWTmA4HYMEQqEw+FYfng+LkTAsdL0BKo1CYJJMahMPECYRnQqXZ4WRzoCw6CxcDmOSyWBkIKlmNTqRwGvx+GrvXkYEHioWwuHoT2YMDYWDSb3w0IAC0ExEl0tl8sVytVvBOGsJRUQfwsNs53nTNJMNUezUNihtfjMnKcil0yhMLtFAsh0M9Qbhvv9gaSImmYCkofDzDlAHFkSlyExkGrcknzimECY6m9PJTqbStPSnpbeuo1Fu1HnOToFzW3YKGyKfX6A1J0O3O92w8Q+6jB8PRxwdNl1fkp9rLVp0+hM5YW4NHmFp-FoihvL+fgNBoJgVp4h5isewpejAYjIAQthNqGIgAMYhhhtgRlKpAynKCpKiq44El+xLPM45S5lwnQvI4W5OBauZ6v03h1Noig9OBiF1h6IpoYRV4drMt54SGECYfeTADkOI5jgm+KTlqdE-o4EFUtm2h2lU1hrpSZTmJoZgrr07yzsJ7onqhYDoZhkk3jh+HyURD5Pqpr7vhOn5afI9EuPuRosSu7Grs0GhfK4FSeGoFRaGouZqPZyGNuJrmej2AA2YCEcRUbkbGVHqR+mpEiFlrpqo3JqB0iVmE4mgWhYuZvDBhrcuYJgDZl9YoegOVYde0kFUVCk+SpL6VYF1XThWTjoF4TIaKxXDaB8Fq-syTWeDxai6X8GhDaJTkueNUldlNxWzc+Y5vomQU1cUfy6eUXJboZ3IaCZzTsnqTh6DocVmCopYZUEQKukhw3Zc5EkTXdYaFQ9SmPnNY6KAFNHBR9K56T9hhGQDFpfBo-4wQJpIrlZF2OaNyO5fC1AiKCYAlaR0YUXG1Gae9qY9GYa1wV8Rg8S8WgWlZFiuE1rX-FadpMyNY1udJHNc4pylPYLb3LV0errVom0rtt5tmJxJ3oEYnUqHoXx2gCsN8iJzOa6jUg69zj1+S9GlG9+fgfOLVR-FDAlMpxK7-hYnXcl0FZ1G7Qy1g5I0JLgBCzPdmGkHgEI82RMaUfG+NC8tLzU+mXJcHapR+Ht7jqJ8x2neb6uNjnYB52AftFyXka82VFeG0t34x2UsENMopjNXacu-P+vjg84sH9F8Pcij7w9iAk0gLCI2Cgnr2MGwtBPCz+Nr1L+nI0n8pI22u+6rSWTJAdo6dw5nWU963SkAfI+UgT5nwvr5F8QcqrJm-D0Fw9NNqbUsKYWooEmQNVduBRO+5167y9PvYuh9j6n3PgHF8eNXpT20qWckC4qSzmXDFVMeD-yP1qFZZKbEAjuwwMgaQ3NkhpEyNfauodUroAftyIsvxTCmllmuU0ep2jmBXAaCssFAiwykIICAcBZBoBofA7SABafMiAzEVk3NuOxdjG6IXwEQMAJjaK1W5HLDcbgjCGi4BYUGFgax7AOOMMQbjCaIBXGULkvx2R1GtBvSxLRTTlDQcxLwPgKiEIibfOCNoKRMJpJDFccd9R2NLOvRuTJCHoBDFJXJ047Q2mzFuRwdpQbmmUbBaR-RX6eE6pWWpR5wnB1obVSGDDYJFJYaBKoLgToRQCd8GyMMM4jMuk2FsF5Gmh0NKbH4uZwZpV8IDVMXJqYVlkXaMyDtalnlbJePKYZdnaT0GlNahyDS1FJIaTBnVvpWRMA-cCA1zr8IAYjU88JtltmAT2V5tV9w2K3JSU6cVfBKILL+PUcFLDfF+UuWpY1EUklavOaZS4SmsIQF0MWnIFwP33MCgJxLWZYWebJQipKHBVApYuZh1LOIGHKNMvpupNo8ghRsr27KtZo1kl5Hllp9yqDUF0dMwLkGJ04noVw0yjppRQWy662F0bTWaHA9xH1IYQWNLBIFs5YI7kpnOASYNwIQysnw9ZCNNne3hea7lYzTFIvBtTdVgEtW1x1WuXoCtPBGF8JoNi7xnTSr9bK01no-bKu+MYdQup6jcmtNUGlTqWR6F1N4Xo+g-4eyzkjU1Ptc0hutUoP4EENo7nWgNI0WLECzlUevat7xjTGlqX3AeBdbAH2VfPam+zE6kmcKlXSe1lDt3SrOb4S6gkZs9tnXOswh4kPnZ4bizheruCslZW2w6q26THXW2pxCIRgIgaCZV7JVDbR6B8LV7hwagQBhBV+Ds6jAtvTWQRUhXFtsiQgTxyiGKuzpFmd4rKdFAA */
  context: {
    count: 0,
    input: '',
    who: '',
    day: '',
    time: '',
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
      after: {
        10000:  "PromptAndAsk",
      },
      on: {
        CLICK: "PromptAndAsk",
      },
    },

    PromptAndAsk: {
      initial: "Prompt",
      on: {
        ASR_NOINPUT: {
          target: "PromptAndAsk.hist",
          //reenter: true,
          actions: [{
            type: "say",
            params: "I didn't hear you",
          }],  
      }},
      
      states: {
        hist: {
          type: 'history', //why does it keeo going to AskWho??
          history: "deep",
        },
        Prompt: {
          entry: [{
            type: "say",
            params: `Let's create an appointment!`,
          }],
          on: { SPEAK_COMPLETE: "AskPerson" },
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
              entry: "startListening",
              on: {
                RECOGNISED: [{
                  guard: "inGrammar", //tbd: & is person
                  target: "#DM.PromptAndAsk.getDay",
                  actions: assign ({
                    who: ({ event }) => getPerson(event.value[0].utterance)
                  }),
                }, {
                  target: "AskWho", //latER: make sure it asks who to meet with again
                  actions: "notInGrammar",
                  reenter: true,
                }],
              },
            },
          },
        },

        getDay: {
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
              entry: "startListening",
              on: {
                RECOGNISED: [{
                  guard: "inGrammar",
                  target: "AskWholeDay",
                  actions: assign ({
                    day: ({ event }) => event.value[0].utterance,
                  }),
                }, {
                  target: "AskWhichDay", //latER: make sure it asks when to meet with again (see person issue)
                  actions: "notInGrammar",
                }],
              },
            },
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
              entry: "startListening",
              on: {
                RECOGNISED: [{ // if 'Yes' -> create whole day appt
                  guard: ({ event }) => asBoolean(event.value[0].utterance),
                  target: "#DM.PromptAndAsk.CreateWholeDayAppt",
                }, { // if 'No' -> ask time
                  guard: "isNegation",
                  target: "AskTime",
                }, {
                  target: "AskWholeDay", //latER: make sure it asks if whole day again
                  actions: "notInGrammar",
                }],
              },
            },
            AskTime: {
              entry: [{
                type: "say",
                params: `What time would you like to meet ?`,   
              }],
                on: { SPEAK_COMPLETE: "ListenTime" },
            },    
            ListenTime: {
              entry: "startListening",
              on: {
                RECOGNISED: [{
                  guard: "inGrammar",
                  target: "#DM.PromptAndAsk.CreateTimeAppt",
                  actions: assign ({
                    time: ({ event }) => event.value[0].utterance,
                  }),
                }, {
                  target: "AskTime", //latER: make sure it asks what time
                  actions: "notInGrammar",
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
                getTime(context.time)
              } ?`;
            },
          }],
            on: { SPEAK_COMPLETE: "ListenApptConfirm" }
        },
        ListenApptConfirm: {
          entry: "startListening",
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
              target: "ListenApptConfirm",
              actions: "notInGrammar",
              reenter: true,
            }]
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
});

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
