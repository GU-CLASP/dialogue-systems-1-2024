import { assign, createActor, setup } from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure.js";

/*Note on lab5:

Justifications for confidence threshholds:
I put the ASR threshhold lower than the NLU one for two reasons. First, the NLU is what is actually used to fetch
the values that are stored in the context, which are then used to "book" the meeting. Of course, if the system is overly
confident of its NLU BECAUSE it was based on faulty ASR, this would still be a problem, but this did not happen that much in
my experience. Second, there were times the system did not meet the ASR while it met the NLU threshhold while I also during
testing logged both, and I could see that while the ASR was slightly off, the NLU would have been fine due to my entities
catching what was needed. As a user, I would then ask to redo when it was not really necessary.
The specific threshholds are somewhat arbitrary, but roughly speaking: when the system is right on the NLU, it is generally
quite confidently right, so 0.7 seemed reasonable. 0.5 for ASR sprung from this value with the reasoning given above.

The code largely does what's requested. Of note: 1. There are a few bugs I couldn't iron out: in some cases when the input isn't clear, the
the system goes idle, and I don't quite know why. 2. confirmationSpecifier() function was meant to be generally used, but I did not have
time to make it properly format the utterances in the DecideIntents state. This should be easy enough to solve, but for now it does not
use proper syntax. This is just an issue with the utterances: if it gets an affirmative response, it manages to go ahead to whatever
is supposed to be the next step. 3. Due to time constraints, the code is far from as general as I'd like it to be. There are some 
generalising features (function, parent state event checkers), but far from enough. Most notably, there are a lot of reused guards.
*/

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


const noInputPrompts = ["I'm sorry, I didn't catch that.", "I can't hear you", "I'm sorry, you seem to be silent!"]
const noUnderstanding = ["I'm sorry, I don't understand", "I don't seem to understand", "I don't quite understand what you're saying"]

function confirmationSpecifier(nlu, asr, semGroundingStr, extract="entity") {
  // args: nlu value in speechstate format, asr value in speechstate format,
  //grounding formatting sentence, nluTarget: i.e., entity or intent
  //See note at top for issues.
    
  let nluTarget = (extract === "entity") ? nlu.entities[0] : nlu.intents[0]


  if (asr.confidence < 0.5 && nluTarget.confidenceScore < 0.7) 
  {  return `Did you say ${asr.utterance} and ${semGroundingStr} ${nluTarget.text}`}
  else if (asr.confidence < 0.5) {return `Did you say ${asr.utterance}`}
  else {return `${semGroundingStr} ${nluTarget.text}`}
};


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
    reprompts: 0
    
  },
  id: "DM",
  initial: "Prepare",
  on: { ASR_NOINPUT: {target: "#DM.TryAgainNoInput",
   reenter: true,
   actions: assign({reprompts: ({ context }) => context.reprompts +=1}),},
  
  RECOGNISED: [{
    // Help occurs if both intent[0] and entity[0] is "help", or if the entire utterance is "Help". When I only had the "help" intent,
    //I found that "help" was often (spuriously) the top intent in cases where the state only tries to find  entity information
    //I want the machine to focus on the proper entity in these cases. The current iteration tries to cast a wide but specific net
    guard: ({ event }) => (event.nluValue.topIntent === "help" && event.nluValue.entities[0].category === "helpEnt") ||
    (event.value[0].utterance === "Help"),
    target: "#DM.Hist",                
    actions:
    ({ context }) =>
    context.ssRef.send({
      type: "SPEAK",
      value: {
        utterance: `You'll be asked questions. You should answer each question with no extra information.'`,
      },
    }),
  },
  {target: "#DM.TryAgainUnderstanding", actions: assign({reprompts: ({ context }) => context.reprompts +=1}),},],},
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
      after: {
        10000: "DecideIntent"
      },
    },

    TryAgainNoInput: {
      entry: ({ context }) =>
      context.ssRef.send({
        type: "SPEAK",
        value: {
          //modulo of reprompts gives an appropriate index for noInputPrompts
          //context.reprompts is reset whenever the system moves forward, so the system
          //does not remember the previous reprompt
          utterance: `${noInputPrompts[(context.reprompts)%3]}`,

        },
      }),
      on: { SPEAK_COMPLETE: { guard: ({ context }) => context.reprompts < 3,
      target: "Hist",},

      target: "Final",
      actions: assign({reprompts: ({ }) => 0}),
     },
    },
    TryAgainUnderstanding: {
      entry:
      ({ context }) =>
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: `${noUnderstanding[(context.reprompts)%3]}`,
        },
      }),
      on: { SPEAK_COMPLETE: { guard: ({ context }) => context.reprompts < 3,
      target: "Hist",},

      target: "Final",
      actions: assign({reprompts: ({ }) => 0}),
     },
    },
  
    Hist: {type: "history"},

    DecideIntent: {
      initial: "Prompting",
      
      states: {
        Hist: {
          type: "history",
          entry: {target: "Prompting"}
        },
        Prompting:{
          entry: 
            {        
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
                guard: ({ event }) => (event.nluValue.topIntent === "who is X" && event.value[0].confidence >= 0.5 &&
                event.nluValue.intents[0].confidenceScore >= 0.7
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

            {guard: ({ event }) => (event.nluValue.topIntent === "create a meeting" && event.value[0].confidence >= 0.5
            && event.nluValue.intents[0].confidenceScore >= 0.7),
              target: "#DM.InitialiseAppointment",
              actions: assign({reprompts: ({ }) => 0}),
            },
            {
              guard: ({ event }) => (event.nluValue.topIntent === "create a meeting" || 
              (event.nluValue.topIntent === "who is X" && event.nluValue.entities.length > 0 &&
               event.nluValue.entities[0].text in famousPeopleDescriptions)),
              target: "Confirmation",
              actions: [({ event }) => console.log(event.nluValue, event.value[0]),
                assign({
                confirmationNLU: ({ event }) => event.nluValue
              }),
              assign({
                confirmationASR: ({ event }) => event.value[0]
              }),],},

           ],
            },
          },
        Confirmation: {
          //This confirmation state is a bit messier than the rest since there is more disambiguation required in DecideIntent
          //than elsewhere
          initial: "Confirming",
          states: {
          Confirming: {
            always: [
              { guard: ({ context }) => context.confirmationNLU.topIntent === "who is X",
                    actions: [({ context }) => console.log(context.confirmationNLU, context.confirmationASR),
                    ({ context }) => context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `${confirmationSpecifier(context.confirmationNLU, context.confirmationASR,
                          `do you want to know about who`, "intent")} ${context.confirmationNLU.entities[0].text}`,
                      },}),],},
                  { guard: ({ context }) => context.confirmationNLU.topIntent === "create a meeting",
                    actions: [({ context }) => console.log(context.confirmationNLU, context.confirmationASR),
                    ({ context }) => context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `${confirmationSpecifier(context.confirmationNLU, context.confirmationASR,
                          `do you want to`, "intent")}`,
                      },}),],},],
                on: { SPEAK_COMPLETE: "Resolving" },},
      Resolving: {
        entry: [
          ({ context }) =>
        context.ssRef.send({
          type: "LISTEN",
          value: { nlu: true },
        }),],

        on: {
          RECOGNISED: 
          [
            { 
              guard: ({ event, context}) => (context.confirmationNLU.topIntent === "who is X" && event.nluValue.entities.length > 0 && 
              event.nluValue.entities[0].category === "affirmative"), /*||
              (event.nluValue.topIntent === "who is X" && event.nluValue.entities[0].text in famousPeopleDescriptions)),*/
              //commented code above was meant to allow for restatement, not just affirmation, but it did not work out.
              target: "#DM.Final",
              actions:[
                ({ context }) =>
                context.ssRef.send({
                  type: "SPEAK",
                  value: {
                    utterance: `${famousPeopleDescriptions[context.confirmationNLU.entities[0].text]}`,
                  },}),],},
            {
              guard: ({ event, context }) => (context.confirmationNLU.topIntent === "create a meeting" && 
              event.nluValue.entities[0].category === "affirmative"), //|| event.nluValue.topIntent === "create a meeting"),
              target: "#DM.InitialiseAppointment",
              actions: [({ event }) => console.log(event.nluValue),
              assign({reprompts: ({ }) => 0}),],
            },
            //I just go straight back to the initial prompt if the confirmation is not affirmed, regardless of whether this is due
            //negative confirmation or some irrelevant entity being the top entity, and regardless of the confidence of the confirmation.
            //Trying to confirm a confirmation and similar practices just seems more frustrating from a user perspective, so it seems
            //reasonable to just make a call if the confirmation is not successful.
            {target: "#DM.DecideIntent",}
          ],
        },
      },
    },
  },
},
},
  
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
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "name" && 
                event.nluValue.entities[0].confidenceScore >= 0.7 && event.value[0].confidence >= 0.5 ),
                target: "#DM.WhichDay",
                actions: [assign({
                  person: ({ event }) => event.nluValue.entities[0].text,
                }),
                assign({reprompts: ({ }) => 0}),],
              },
              {
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category  === "name"),
                target: "Confirmation",
                actions: [({ event }) => console.log(event.nluValue, event.value[0]),
                  assign({
                  confirmationNLU: ({ event }) => event.nluValue
                }),
                assign({
                  confirmationASR: ({ event }) => event.value[0]
                }),],},
        
            ],
            },
          },
        Confirmation: {
          initial: "Confirming",
          states: {
            Confirming: {
              always:              
              {actions: [({ context }) => console.log(context.confirmationNLU, context.confirmationASR),
              ({ context }) => context.ssRef.send({
                type: "SPEAK",
                value: {
                  utterance: `${confirmationSpecifier(context.confirmationNLU, context.confirmationASR,
                    `do you want to meet with`)}`,
                },
              }),
            ],
            },
          
          on: { SPEAK_COMPLETE: "Resolving" },
        },

        Resolving: {
          entry: 
            ({ context }) =>
          context.ssRef.send({
            type: "LISTEN",
            value: { nlu: true },
          }),
          on: {
            RECOGNISED: 
            [
              { 
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "affirmative"),
                target: "#DM.WhichDay",
                actions: [assign({
                  person: ({ context }) => context.confirmationNLU.entities[0].text,
                }),
                assign({reprompts: ({ }) => 0}),],       
              },
              {target: "#DM.MeetWho"}
            ],
          },
        },
      },
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
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "DayAndTime" && 
                event.nluValue.entities[0].confidenceScore >= 0.7 && event.value[0].confidence >= 0.5 ),
                target: "#DM.WholeDay",
                actions: [assign({
                  day: ({ event }) => event.nluValue.entities[0].text,
                }),
                assign({reprompts: ({ }) => 0}),],
              },
              {
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category  === "DayAndTime"),
                target: "Confirmation",
                actions: [({ event }) => console.log(event.nluValue, event.value[0]),
                  assign({
                  confirmationNLU: ({ event }) => event.nluValue
                }),
                assign({
                  confirmationASR: ({ event }) => event.value[0]
                }),],},      
            ],
            },
          },
          Confirmation: {
            initial: "Confirming",
            states: {
              Confirming: {
                always:              
                {actions: [({ context }) => console.log(context.confirmationNLU, context.confirmationASR),
                ({ context }) => context.ssRef.send({
                  type: "SPEAK",
                  value: {
                    utterance: `${confirmationSpecifier(context.confirmationNLU, context.confirmationASR,
                      `will the meeting day be`)}`,
                  },
                }),
              ],
              },
            on: { SPEAK_COMPLETE: "Resolving" },
          },
          Resolving: {
            entry: 
              ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
              value: { nlu: true },
            }),
            on: {
              RECOGNISED: 
              [
                { 
                  guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "affirmative"),
                  target: "#DM.WholeDay",
                  actions: [assign({
                    day: ({ context }) => context.confirmationNLU.entities[0].text,
                  }),
                  assign({reprompts: ({ }) => 0}),],         
                },
                {target: "#DM.WhichDay"}
              ],
            },
          },
        },
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
              //I skip confirmation here and just send the user back to the beginning of the state if the newly added confidence threshhold 
              //is not met. This is because the confirmation would just be another yes/no question, which this state already is. If the
              //object is clarity, restating the question should make the user speak more clearly, and "Will it take the whole day?" should
              // not be more of a strain to answer than "Did you say 'yes', and do you want to confirm that it will take the whole day?" 
              //The confirmation seems more suited for nonbinary semantic content.
              {
                guard: ({ event }) => (event.nluValue.entities[0].confidenceScore < 0.7 || event.value[0].confidence < 0.5),
                target: "#DM.WholeDay"
              },
              {
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "affirmative"),
                target: "#DM.AppointmentCreation",
                actions: 
                  [assign({
                  wholeday: "affirmative",
                }),
                assign({reprompts: ({ }) => 0}),],
              },
              {
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "negative"),
                target: "#DM.TimeOfDay",
                actions: assign({reprompts: ({ }) => 0}),

              },
            ],
            },
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
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "DayAndTime" 
                && event.nluValue.entities[0].confidenceScore >= 0.7 && event.value[0].confidence >= 0.5),
                target: "#DM.AppointmentCreation",
                actions: [assign({
                  time: ({ event }) => event.nluValue.entities[0].text,
                }),
                assign({reprompts: ({ }) => 0}),],
              },
              {
                guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "DayAndTime"),
                target: "Confirmation",
                actions: [({ event }) => console.log(event.nluValue, event.value[0]),
                  assign({
                  confirmationNLU: ({ event }) => event.nluValue
                }),
                assign({
                  confirmationASR: ({ event }) => event.value[0]
                }),],},
            ],
            },
          },
          Confirmation: {
            initial: "Confirming",
            states: {
              Confirming: {
                always:              
                {actions: [({ context }) => console.log(context.confirmationNLU, context.confirmationASR),
                ({ context }) => context.ssRef.send({
                  type: "SPEAK",
                  value: {
                    utterance: `${confirmationSpecifier(context.confirmationNLU, context.confirmationASR,
                      `will the meeting time be`)}`,
                  },
                }),
              ],
            },
            on: { SPEAK_COMPLETE: "Resolving" },
          },
          Resolving: {
            entry: 
              ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
              value: { nlu: true },
            }),
            on: {
              RECOGNISED: 
              [
                { 
                  guard: ({ event }) => (event.nluValue.entities.length > 0 && event.nluValue.entities[0].category === "affirmative"),
                  target: "#DM.AppointmentCreation",
                  actions: [assign({
                    time: ({ context }) => context.confirmationNLU.entities[0].text,
                  }),
                  assign({reprompts: ({ }) => 0}),],    
                },
                {target: "#DM.TimeOfDay"}
              ],
            },
          },
        },
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
            ],
            },
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
