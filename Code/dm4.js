import { assign, createActor, setup } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure.js";

/* Note on lab4:
The final clu model is much simpler than it initially was.
I had trouble with too many entities of inconsistent categories, which got in the way of my dialogue management.
For example, I wanted to make use of the built in ways of recognising time-utterances to get broader coverage,
but doing this both for a "Day" and a "Time" entity makes both entities get recognised equally confidently in a state 
where only one matters.

There are also some general NLU issues, such as that "it will not" possibly being recognised as affirmative (since it contains
"it will").

Overall, the system could use some work, but at least it consistently manages to recognise which task is supposed to be performed
based on intent (not always the proper entity), and it can book appointments with more variable inputs than before,
if not quite as consistently.*/

const inspector = createBrowserInspector();

const azureCredentials = {
  endpoint:
    "https://northeurope.api.cognitive.microsoft.com/sts/v1.0/issuetoken",
  key: KEY,
};

const azureLanguageCredentials = {
  endpoint: "https://language-resource-ds1.cognitiveservices.azure.com/language/:analyze-conversations?api-version=2022-10-01-preview" /** your Azure CLU prediction URL */,
  key: NLU_KEY,
  deploymentName: "appointment" /** your Azure CLU deployment */,
  projectName: "appointment" /** your Azure CLU project name */,
};

const settings = {
  azureLanguageCredentials: azureLanguageCredentials,
  azureCredentials: azureCredentials,
  asrDefaultCompleteTimeout: 0,
  asrDefaultNoInputTimeout: 5000,
  locale: "en-US",
  ttsDefaultVoice: "en-US-DavisNeural",
};


//Ursula Leguin, JRR Tolkien
const famousPeopleDescriptions = {
  //Both Le Guin and Leguin seems to be in the prebuilt name module, so I just put in both.
  "Ursula Le Guin": "Ursula K. Le Guin was an American science fiction and fantasy author born in 1929 and dead in 2018. \
  She often included political and social themes in her fiction, as well as in her published non-fiction works. ",
  "Ursula Leguin": "Ursula K. Le Guin was an American science fiction and fantasy author born in 1929 and dead in 2018. \
  She often included political and social themes in her fiction, as well as in her published non-fiction works. ",
  "Adrian Tchaikovsky": "Adrian Tchaikovsky is a British award-winning science fiction and fantasy author born in 1952.\
  He is perhaps best known for his Children of Time series, the first novel in which came out in 2015.",
  //The clu has some issues with some pronunciation of Tolkien and his initials
  "JRR Tolkien": "John Ronald Reuel Tolkien, born 1892 and dead 1973, was a British author and philologist.\
  He is best known as the author of the popular Lord of the Rings trilogy, which is considered a foundational work\
  for moden fantasy. ",
  "Bruce Dickinson": "Bruce Dickinson, born 1958, is the lead vocalist of British heavy metal band Iron Maiden. \
  He was active in the band first from 1981 to 1993, then from 1999 to the present day.",
  "Octavia Butler": "Octavia E. Butler, 1947 to 2006, was an American science fiction author. Her work often included\
  societal critiques.",
  //Terry Pratchett was not part of the utterance labelling training, which shows that (at least public figures) the model
  //perhaps relies more on the prebuilt name entity module.
  "Terry Pratchett": "Terry Pratchett, 1948 to 2015, was a British fantasy author, best known for his Discworld books. These\
  works tended towards satire of everything from society to fiction.",
};


/*const grammar2 = {
  people: { vlad: "Vladislav Maraev", aya: "Nayat Astaiza Soriano", rasmus: "Rasmus Blanck", santa: "Santa Claus" },
  days: { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday",},
  times: { "7": "7:00", "8": "8:00", "9": "9:00", "10": "10:00", "11": "11:00", "12": "12:00", "13": "13:00", "14": "14:00", "15": "15:00", "16": "16:00", "midnight": "00:00"},
  affirmative: { yes: "Yes", "of course": "Of course", "that's right": "That's right" },
  negative: { no: "No", "no way": "No way", nope: "Nope", "it will not": "It will not" }
};

function isInGrammar2(utterance, category) {
  return utterance.toLowerCase() in grammar2[category];
}*/

const dmMachine = setup({
  actions: {
      speak: ({ context }, params) =>
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: `${params}`,
        },
      }),
      listen: ({ context } ) =>
      context.ssRef.send({
        type: "LISTEN",
      }),
  },
}).createMachine({
  context: {
    test: `testing` 
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
        CLICK: "DecideIntent",
      },
      /*after: {
        10000: "DecideIntent"
      },*/
    },

    DecideIntent: {
      initial: "Prompting",
      states: {
        Prompting:{
          entry: {        
            type: "speak",
            params: `What can I help you with?`
        },
          on:{
            SPEAK_COMPLETE: "Listening"
            },
        },
        Listening: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "LISTEN",
            value: { nlu: true },
          }),

          on: {
            RECOGNISED:
            [            
              {
                guard: ({ event }) => (event.nluValue.topIntent === "who is X" && event.nluValue.intents[0].confidenceScore > 0.5 
                && event.nluValue.entities.length > 0 && event.nluValue.entities[0].text in famousPeopleDescriptions),
                target: "#DM.Final",                
                actions:
                ({ context, event }) =>
                context.ssRef.send({
                  type: "SPEAK",
                  value: {
                    utterance: `${famousPeopleDescriptions[event.nluValue.entities[0].text]}`,
                  },
                }),
              },

            {guard: ({ event }) => (event.nluValue.topIntent === "create a meeting" && event.nluValue.intents[0].confidenceScore > 0.5),
              target: "#DM.InitialiseAppointment",
            },
              {target: "TryAgain",
            actions: ({ event }) => console.log(event.nluValue)},
            ],       
             
            ASR_NOINPUT: {target: "TryAgain"},
            },
          },
        TryAgain: {
          entry: {
            type: "speak",
            params: `I'm sorry, I didn't catch that.`
          },
          on: { SPEAK_COMPLETE: "#DM.DecideIntent" },
        },
      },
    },

    /*FastBook: {
      This was for a state that was supposed to take the first input utterance (for example "I'd like to book an appointment
      with Vlad on Tuesday at 12") and book the appointment from only that, and would only send the user down the usual path if
      if failing. But it didn't really work out.
    },*/

    InitialiseAppointment: {
      entry: {        
          type: "speak",
          params: `Let's book an appointment!`
        },
        on: {
          SPEAK_COMPLETE: "MeetWho",
          CLICK: "WaitToStart",
        },
    },

    MeetWho: {
      initial: "Prompting",
      states: {
        Prompting:{
          entry: {        
            type: "speak",
            params: `Who are you meeting with?`
        },
          on:{
            SPEAK_COMPLETE: "Listening"
            },
        },
        Listening: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "LISTEN",
            value: { nlu: true },
          }),

          on: {
            RECOGNISED: [
              {
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "name"),
                target: "#DM.WhichDay",
                actions: assign({
                  person: ({ event }) => event.nluValue.entities[0].text,
                }),
    
                
              },
              {target: "TryAgain"}         
            ],
            ASR_NOINPUT: {target: "TryAgain"},
            },
          },
        TryAgain: {
          entry: {
            type: "speak",
            params: `I'm sorry, I didn't catch that.`
          },
          on: { SPEAK_COMPLETE: "#DM.MeetWho" },
        },
      },
    },

    WhichDay: {
      initial: "Prompting",
      states: {
        Prompting:{
          entry: {        
            type: "speak",
            params: `On which day is your meeting?`
        },
          on:{
            SPEAK_COMPLETE: "Listening"
            },
        },
        Listening: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "LISTEN",
            value: { nlu: true },
          }),

          on: {
            RECOGNISED: [
              {
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "DayAndTime"),
                target: "#DM.WholeDay",
                actions: assign({
                  day: ({ event }) => event.nluValue.entities[0].text,
                }),

              },
              {target: "TryAgain"}         
            ],
            ASR_NOINPUT: {target: "TryAgain"},
            },
          },
        TryAgain: {
          entry: {
            type: "speak",
            params: `I'm sorry, I didn't catch that.`
          },
          on: { SPEAK_COMPLETE: "#DM.WhichDay" },
        },
      },
    },

    WholeDay: {
      initial: "Prompting",
      states: {
        Prompting:{
          entry: {        
            type: "speak",
            params: `Will it take the whole day?`
        },
          on:{
            SPEAK_COMPLETE: "Listening"
            },
        },
        Listening: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "LISTEN",
            value: { nlu: true },
          }),

          on: {
            RECOGNISED: [
              {
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "affirmative"),
                target: "#DM.AppointmentCreation",
                actions: 
                  assign({
                  wholeday: "affirmative",
                }),

                
              },
              {
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "negative"),
                target: "#DM.TimeOfDay",

              },
              {target: "TryAgain"}         
            ],
            ASR_NOINPUT: {target: "TryAgain"},
            },
          },
        
        TryAgain: {
          entry: {
            type: "speak",
            params: `I'm sorry, I didn't catch that.`
          },
          on: { SPEAK_COMPLETE: "#DM.WholeDay" },
        },
      },
    },
    
    TimeOfDay: {
      initial: "Prompting",
      states: {
        Prompting:{
          entry: {        
            type: "speak",
            params: `What time is your meeting?`
        },
          on:{
            SPEAK_COMPLETE: "Listening"
            },
        },
        Listening: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "LISTEN",
            value: { nlu: true },
          }),

          on: {
            RECOGNISED: [
              {
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "DayAndTime"),
                target: "#DM.AppointmentCreation",
                actions: assign({
                  time: ({ event }) => event.nluValue.entities[0].text,
                }),

              },
              {target: "TryAgain"}         
            ],
            ASR_NOINPUT: {target: "TryAgain"},
            },
          },
        TryAgain: {
          entry: {
            type: "speak",
            params: `I'm sorry, I didn't catch that.`
          },
          on: { SPEAK_COMPLETE: "#DM.TimeOfDay" },
        },
      },
    },

    AppointmentCreation: {
      initial: "WholeDayDisambig",  
      states: {
        WholeDayDisambig: {
          always: [{
            guard: ({ context }) => context.wholeday === "affirmative",
            target: "PromptingWholeDay",
          },
          {target: "PromptingPartialDay"},
        ],
        },
        PromptingWholeDay:{
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                //the extra "." after context.person is just for a pause in the utterance. This is because
                //I removed the preposition that was there before since the new variable ways of recording 
                //context values sometimes include their own prepositions. The removed preposition seems more
                //natural in cases where the preposition is not in the context value than the double prepositions
                //when the prepositition is in the context value 
                utterance: `Do you want me to create an appointment with ${context.person}. ${context.day}
                for the whole day?`,
              },
            }),
          on: { SPEAK_COMPLETE: "Listening" },

        },
        PromptingPartialDay: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: `Do you want me to create an appointment with ${context.person}. ${context.day}.
                ${context.time}?`,
              },
            }),
          on: { SPEAK_COMPLETE: "Listening" },
        },
        Listening: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "LISTEN",
            value: { nlu: true },
          }),

          on: {
            RECOGNISED: [
               {
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "affirmative"),
                target: "#DM.Final",
              actions: {
                type: "speak",
                params: `Your appointment has been created! Click again to book another one.`
              },  
              },
              {
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "negative"),
                target: "#DM.InitialiseAppointment",
                actions: {
                  type: "speak",
                  params: `All right! Let's try again.`
                }

              },
              {target: "TryAgain"}         
            ],
            ASR_NOINPUT: {target: "TryAgain"},
            },
          },

        TryAgain: {
          entry: {
            type: "speak",
            params: `I'm sorry, I didn't catch that.`
          },
          on: { SPEAK_COMPLETE: "#DM.AppointmentCreation" },
        },
      },
    },
    Final: {
      on: {
        CLICK: "DecideIntent",
      },
    },
  },
});

const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();


export function setupButton(element) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
    element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
  });
}
