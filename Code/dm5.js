import { assign, createActor, setup, and, or, not} from "xstate";
import { speechstate } from "speechstate";
import { createBrowserInspector } from "@statelyai/inspect";
import { KEY, NLU_KEY } from "./azure.js";

/*Note on lab5:
Note on resubmission of lab 5:
I have fixed the issues that arrose when there are no entities. In conjunction, I added proper higher level guards instead
of the pure javascript combination guards I had before.

After much scratching of my head, I think I also fixed the issue with the help state and the noUnderstanding state.
(though I have not tested the fix in every state)
They seemed identical to the noInput state in all ways that matter for the issue, so it was a bit confusing. 

The states themselves seem to have been fine; the problem is what seems like an inconsistency between how the asr_noinput
and the recognised events relate to a history state if that history state is on the same level as the event.
The problem wasn't that help/noUnderstanding crashed, but rather that they for some reason sent to the state before the previous
state, rather than just to the previous state. So if entered mid-dialogue, they would send back to a stage of the meeting booking
that had already been stored, and if entered at the beginning of the dialogue, they would send back to WaitToStart. So the system 
is idle not because of a crash, but because WaitToStart is an idle state. I don't know if there is a purpose to this since on the xstate
level, noinput and recognised are both just events that should behave the same. It seems more like an oversight.

I fixed it (again, I think) by putting everything in my machine except the utility states into a parent state, and targetting a history
state inside this parent state with my utility state transitions.

*/


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
  guards: {
    nluConfidence: ({ event }) => event.nluValue.intents[0].confidenceScore >= 0.7,
    asrConfidence: ({ event }) => event.value[0].confidence >= 0.5,
    nluEntConf: ({ event }) =>  event.nluValue.entities[0].confidenceScore >= 0.7,
    
    createMeeting: ({ event }) => event.nluValue.topIntent === "create a meeting",
    whoIsX: ({ event }) => event.nluValue.topIntent === "who is X",
    confWhoIsX: ({ context }) => context.confirmationNLU.topIntent === "who is X",
    confCreateMeeting: ({ context }) => context.confirmationNLU.topIntent === "create a meeting",
    noEntities: ({ event }) => event.nluValue.entities.length < 1,
    helpInt: ({ event }) => event.nluValue.topIntent === "help",
    helpEnt: ({ event }) => event.nluValue.entities[0].category === "helpEnt",
    helpAsr: ({ event }) => event.value[0].utterance === "Help",
    inFamous: ({ event }) => event.nluValue.entities[0].text in famousPeopleDescriptions,
    yes: ({ event }) => event.nluValue.entities[0].category === "affirmative",
    no: ({ event }) => event.nluValue.entities[0].category === "negative",
    nameEnt: ({ event }) => event.nluValue.entities[0].category === "name",
    DayTimeEnt: ({ event }) => event.nluValue.entities[0].category === "DayAndTime",

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
    guard: or([and(["helpInt", "helpEnt"]), "helpAsr" ]),
    target: "#DM.HelpIntermediate",                
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
        CLICK: "System.DecideIntent",
      },
      /*after: {
        10000: "DecideIntent"
      },*/
    },
    HelpIntermediate: {
      on: { SPEAK_COMPLETE: "System.SystemHist",}
    },

    TryAgainNoInput: {
      entry: ({ context }) =>
      context.ssRef.send({
        type: "SPEAK",
        value: {
          utterance: `${noInputPrompts[(context.reprompts)%3]}`,

        },
      }),
      on: { SPEAK_COMPLETE: [{ guard: ({ context }) => context.reprompts < 3,
      target: "System.SystemHist",},

      {target: "Final",
      actions: assign({reprompts: ({ }) => 0}),}]
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
      on: { SPEAK_COMPLETE: [{ guard: ({ context }) => context.reprompts < 3, target: "System.SystemHist",},
      {target: "Final", actions: assign({reprompts: ({ }) => 0}),}]
     },
    },
  
  
    System: {
      initial: "DecideIntents",
      states: {
        SystemHist: {type: "history"},
        DecideIntent: {
          initial: "Prompting",
          
          states: {

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
                  {guard: and(["createMeeting", "asrConfidence", "nluConfidence"]),
                  target: "#DM.System.InitialiseAppointment",
                  actions: assign({reprompts: ({ }) => 0}),
                },
                {
                  guard: "createMeeting", 
                  target: "Confirmation",
                  actions: [
                    assign({
                    confirmationNLU: ({ event }) => event.nluValue}),
                  /*assign({
                    confirmationASR: ({ event }) => event.value[0]
                  }),*/],},
                  {guard: "noEntities", target: "#DM.TryAgainUnderstanding"},
                  { 
                    guard: and(["whoIsX", "asrConfidence", "nluConfidence", "inFamous"]),
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
                {
                  guard: and(["whoIsX", "inFamous"]),
                  target: "Confirmation",
                  actions: [
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
                        actions:
                        ({ context }) => context.ssRef.send({
                          type: "SPEAK",
                          value: {
                            utterance: `Do you want to know who ${context.confirmationNLU.entities[0].text} is?`,
                          },}),},
                      { guard: ({ context }) => context.confirmationNLU.topIntent === "create a meeting",
                        actions: 
                        ({ context }) => context.ssRef.send({
                          type: "SPEAK",
                          value: {
                            utterance: `Do you want to book a meeting?`,
                          },}),},],
                    on: { SPEAK_COMPLETE: "Resolving" },},
                    
    
          Resolving: {
            entry:
              ({ context }) =>
            context.ssRef.send({
              type: "LISTEN",
              value: { nlu: true },
            }),
    
            on: {
              RECOGNISED: 
              [ {guard: "noEntities", target: "#DM.TryAgainUnderstanding"},
                { guard: and(["confWhoIsX", "yes"]),  
                  target: "#DM.Final",
                  actions:[
                    ({ context }) =>
                    context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `${famousPeopleDescriptions[context.confirmationNLU.entities[0].text]}`,
                      },}),],},
                {
                  guard: and(["confCreateMeeting", "yes"]),
                  target: "#DM.System.InitialiseAppointment",
                  actions: 
                  assign({reprompts: ({ }) => 0}),
                },
                //I just go straight back to the initial prompt if the confirmation is not affirmed, regardless of whether this is due
                //negative confirmation or some irrelevant entity being the top entity, and regardless of the confidence of the confirmation.
                //Trying to confirm a confirmation and similar practices just seems more frustrating from a user perspective, so it seems
                //reasonable to just make a call if the confirmation is not successful.
                {target: "#DM.System.DecideIntent",}
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
                  {guard: "noEntities", target: "#DM.TryAgainUnderstanding"},
                  {
                    guard: and(["nameEnt", "nluEntConf", "asrConfidence"]),
                    target: "#DM.System.WhichDay",
                    actions: [assign({
                      person: ({ event }) => event.nluValue.entities[0].text,
                    }),
                    assign({reprompts: ({ }) => 0}),],
                  },
                  {
                    guard: "nameEnt",
                    target: "Confirmation",
                    actions: [
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
                  {actions: 
                  ({ context }) => context.ssRef.send({
                    type: "SPEAK",
                    value: {
                      utterance: `${confirmationSpecifier(context.confirmationNLU, context.confirmationASR,
                        `do you want to meet with`)}`,
                    },
                  }),
                
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
                [{guard: "noEntities", target: "#DM.TryAgainUnderstanding"},
                  { 
                    guard:  "yes",
                    target: "#DM.System.WhichDay",
                    actions: [assign({
                      person: ({ context }) => context.confirmationNLU.entities[0].text,
                    }),
                    assign({reprompts: ({ }) => 0}),],       
                  },
                  {target: "#DM.System.MeetWho"}
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
                  {guard: "noEntities", target: "#DM.TryAgainUnderstanding"},
                  {
                    guard: and(["DayTimeEnt", "nluEntConf", "asrConfidence"]),
                    target: "#DM.System.WholeDay",
                    actions: [assign({
                      day: ({ event }) => event.nluValue.entities[0].text,
                    }),
                    assign({reprompts: ({ }) => 0}),],
                  },
                  {
                    guard: "DayTimeEnt",
                    target: "Confirmation",
                    actions: [
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
                    {actions: 
                    ({ context }) => context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `${confirmationSpecifier(context.confirmationNLU, context.confirmationASR,
                          `will the meeting day be`)}`,
                      },
                    }),
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
                  [{guard: "noEntities", target: "#DM.TryAgainUnderstanding"},
                    { 
                      guard: "yes",
                      target: "#DM.System.WholeDay",
                      actions: [assign({
                        day: ({ context }) => context.confirmationNLU.entities[0].text,
                      }),
                      assign({reprompts: ({ }) => 0}),],         
                    },
                    {target: "#DM.System.WhichDay"}
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
                  {guard: "noEntities", target: "#DM.TryAgainUnderstanding"},
                  {
                    guard: or([not("nluEntConf"), not("asrConfidence")]),
                    target: "#DM.System.WholeDay",
                  },
                  {
                    guard: "yes",
                    target: "#DM.System.AppointmentCreation",
                    actions: 
                      [assign({
                      wholeday: "affirmative",
                    }),
                    assign({reprompts: ({ }) => 0}),],
                  },
                  {
                    guard: "no",
                    target: "#DM.System.TimeOfDay",
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
                  {guard: "noEntities", target: "#DM.TryAgainUnderstanding"},
                  {
                    guard: and(["DayTimeEnt", "nluEntConf", "asrConfidence"]),
                    target: "#DM.System.AppointmentCreation",
                    actions: [assign({
                      time: ({ event }) => event.nluValue.entities[0].text,
                    }),
                    assign({reprompts: ({ }) => 0}),],
                  },
                  {
                    guard: "DayTimeEnt",
                    target: "Confirmation",
                    actions: [
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
                    {actions: 
                    ({ context }) => context.ssRef.send({
                      type: "SPEAK",
                      value: {
                        utterance: `${confirmationSpecifier(context.confirmationNLU, context.confirmationASR,
                          `will the meeting time be`)}`,
                      },
                    }),
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
                    {guard: "noEntities", target: "#DM.TryAgainUnderstanding"},
                    { 
                      guard: "yes",
                      target: "#DM.System.AppointmentCreation",
                      actions: [assign({
                        time: ({ context }) => context.confirmationNLU.entities[0].text,
                      }),
                      assign({reprompts: ({ }) => 0}),],    
                    },
                    {target: "#DM.System.TimeOfDay"}
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
                  {guard: "noEntities", target: "#DM.TryAgainUnderstanding"},
                   {
                    guard:  "yes",
                    target: "#DM.Final",
                  actions: {
                    type: "speak",
                    params: `Your appointment has been created! Click again to book another one.`
                  },  
                  },
                  {
                    guard: "no",
                    target: "#DM.System.InitialiseAppointment",
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
      },
    },

    
    Final: {
      on: {
        CLICK: "System.DecideIntent",
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
