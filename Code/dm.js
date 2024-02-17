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
  manos: {person:"Manos Belantakis"},
  vasilis: {person: "Vasilis Daniilidis"},
  eva: {person:"Evaggelia Deligianni"},
  eleni: {person:"Eleni Dochtsi"},
  rasmus: { person: "Rasmus Blanck" },
  victoria: {person: "Victoria Daniilidou"},
  george: {person: "George Daniilidis"},
  ivan: {person:"Ivan Kostov"},
  monday: { day: "Monday" },
  tuesday: { day: "Tuesday" },
  wednesday: {day: "Wednesday"},
  thursday: {day: "Thursday"},
  friday: {day:"Friday"},
  "10": { time: "10:00" },
  "11": { time: "11:00" },
  agree: ["yes", "yeah", "yup","of course"],
  disagree: ["no", "nope"]
  
};

const dearClient = ["Are you there", "talk to me"];
function randomRepeat(myarray){
  const randomIndex =  Math.floor(Math.random() * myarray.length);
  return myarray[randomIndex];
}

/* Helper functions */
function isInGrammar(utterance) {
  return utterance.toLowerCase() in grammar;
  //this gives back the nickname, key returns a boolean
}

function getPerson(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).person;
  //this gives back the full name, value of the value 

  //functions for .date, .time
}
function getDay(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).day;
}
function getTime(utterance) {
  return (grammar[utterance.toLowerCase()] || {}).time;
}
function isTheAnswerYes(utterance){
  return (grammar.agree.includes(utterance.toLowerCase()));
}
function isTheAnswerNo(utterance){
  return (grammar.disagree.includes(utterance.toLowerCase()));
}
function days(grammar){
  return Object.keys(grammar).filter(key=> grammar[key].day);
}

const dmMachine = setup({
  actions: {
    /* define your actions here */
    say: ({ context }, params) =>
  context.ssRef.send({
    type: "SPEAK",
    value: {
      utterance: params,
    },
  }),
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBECyA6ACgJzABwENcBiAQQGUAlAFWvIH1KBRU5ATQG0AGAXUVDwB7WAEsALiMEA7fiAAeiAExcu6AJwA2RQFYuAdi4AOACzaDexQBoQAT0QBGe3vTa1btduMBmRXrXGnAF9A6zR0AHUCcWpBcjEiMWI5WHixMHQCADM07AAKXS4ASmIwyOjY+Owxbj4kECFRCWlZBQR7TXUCrl81buNFY2s7BG1DRXQNY3cNbS8nT0Ng0IwcQQBbPDFSKQhSWABrLGx1zeJyTBYAaXoAYQB5VEwAGSZqJhrZBvFJGTrWqa86Hshj02nsXCcxg0biGiBmhnQxhUKichm0MzMSxAYVWGy2Oz2h0JAHdxAALYlk9ZnC6ka73R4vN4fOpfJq-UCtHTGdSglQacFeMHoqy2RB6Yw8pHIpHGPQzRRYnHHPHbXYHdBPEQpMBSUliClUtbEZj3ADiADkAJLkJjIFkCYTfZp-JQzFz2Aaafxjfqi4aGLgaIHIrjGQzg1z2bRKlYqzZqwma7VpPXkynU013S02u0cey1R2NH4tN3aD1e6HhgaKf2INT2HnaLpqLyGMaKMaxo4nfHqw5anVpg0Z40USj0C13K0WzAAVWoDvqTvZpYQindYMrPprdYQDabLbbHa7IWxcd7iY1NwIUgNYCINKutwez1e714nxXJdd688vIKAUuCFaMtFhfd5XQHQUQhMF7A0PQ9G7XEEwJDUAAkH2wfVDUzJhzWtW17U-VlvxdTklFGCYQW0cC1Eg6CIVgxwEKQs9lUvNDDkwogcNHMgqEnadZwXJc2R-Ci-wRDQaPA8ETHQAwUTlTtA1MZD4z7JNCXvCACBsJ86RfRl3zEsiOXkSieXowDBWFMCxTaRtg2lWCpkhYwNM4-tkyHagyUgfSTXw7NCLzEii2dCyuX-Gz+Ts0C909IwQxRLRPBkrxPPYi9VS43zU38wKDKzHMiPzQtl2LcjLL-ay+SDBKRTkuZg2bFRlEMHwfAhLy8p8wdCoCvSDPHISZ3nRcIqqqK125AD4uA+yktalwCk67rlHsPrUJ8kkqQAG2Kwz6VfJkP0q8Sapi+rbKWxKWr0BFGMUaMPB0TQdq0jVBt1IqMyOkbgoI3NiMu8y5oU+DoKAkD0Tk7w1E6DrFCFCM3C+q8BxTP6AoB47SrC+0Cy-aroqUKH0sa+74cc6MIQmda5le+w2xjHKe36pNfqkf7DuOsapwm0Tpqu8n10pmGmo0OT0UBIUOuPJEnsx-LCSK6gRDWMATuMt9mVFiHf3muLqbhhzhmh8suHWqE5QhCVVYGnHeYCzXteB0LQbMsm5tihrYeWuSZODBruS4Nx0UWDmUO+7G-LdrWdcJ72SdI33jf9u7zaSvxy2UDq3Bo1sNCd7mXY1pOBInIWRKm8GM8kk2A+l3OPCg5FFCL0ES7LjUADUwGwERMhsAg8CEEQ721u9dYZfWLtJ2bjYjFx0rktFg16FQvH0XRZi8PvDgtMAoEwYRB+HzJPbK8KG+Xpus8WnO5IbaTkTmMEsosdnlk53akwnzPhfIeI8b5EwqkvVcmdbrPyDnTNQgZ0C7x3rWeUARFQx00ljdAQDz6wEvmAwWwlJo+wfrVZu2d4HDGUP0dAoYvC7y8K2ME2U-6xxwTcXABA0ikAnoIKeYgZ6JHOM+ee50yHQKbu2REVMGzNl8FlQYjlXrAUUh-Ns3Qu7bQ5sgaQOsbhPCtDcS4kiJK1ScMGAuO8I7+ACLRRysxxj+GmIwm2hgGzBDPFIQQEA4CyDQFA8xrQAC0mhwIhODKGCOkobZbTmBpfARAwBBOuogfo4FV5d3cOGLwCE5R6B0X-MoYgYhxASKk8WZhwKjHGBKaYDY35TCPpUtcITww1LlOgQM-I2waD3s2I+-8xCtN-IwnktYCi716J6MYehwIaCFKlZEkcPH9CGSSdMRpRmSS4C1fQyyVCrP8IfLB3ly5Dj4ts9O5DWh7LpuGBErkwxhnlNoV6Qybx3gCkQHZtV7mWw0NCdRyIDBuACEMni2EtnrD+XcjeYJ6HInBNGFiKszlcw1DpYa+k4WIABUoYC4wUEQh6l3HQpcMUAJ+hXHFwxIpSP+eBWsrMJjIvSlCLqbDzzDJwftQQgNcU3MZfClRzDrLItbEGSURSeUcPyjzPmArip4oQASv8DFO6o1GO0NQGyDiV21qq9VvgzAuE7p4WxmIqVxwKrjMA7sUnCuCfi5lrYEQ9O6CYAUhSoRDMIaPcek9p66hGc6tJarwLM1UOCHeqLv46CGXgkBV9jVRt3vYREH9TAKiYZ87hvD+GCOEWmxyWUxgguAvKeCiDo5-z0VIJ1DKXUjD3AEJGnZGFdzRMKbKwQgA */
  context: {
    count: 0,
    MeetingWithwhom: '',
    Dayofmeeting: '',
    Timeofmeeting: '',
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
        "1000": "PromptAndAsk"
      },
      on: {
        CLICK: "PromptAndAsk"
      }
    },
    PromptAndAsk: {
      initial: "Prompt",
      states: {
        Prompt: {
          entry: ({ context }) =>
            context.ssRef.send({
              type: "SPEAK",
              value: {
                utterance: `Let's create an appointment`,
              },
              }),

          on: { SPEAK_COMPLETE: "Askwithwhom" },
        },
        Askwithwhom: {    //changed
          entry: [{
            type: "say",
            params: `Who are you meeting with?`,
          }],  
          on: { SPEAK_COMPLETE: "Listenwithwhom" },
          },

          Listenwithwhom: {
            entry: ({ context }) =>
              context.ssRef.send({
                type: "LISTEN",
              }),
            on: {
              RECOGNISED: [{
              guard: ({event}) => isInGrammar(event.value[0].utterance),
              target: "Asktheday",
              actions: assign({
                MeetingWithwhom: ({event}) => getPerson(event.value[0].utterance),
            })},  //function
              
            {target : "#DM.Done"},
            ],
            ASR_NOINPUT : "Canthear",
            },
          },
          Canthear : {
            entry: ({context}) =>
            context.ssRef.send({
                type: "SPEAK",
                value: {
                    utterance: randomRepeat(dearClient),
                },
            }),
            on: {
                SPEAK_COMPLETE: "#DM.PromptAndAsk.Askwithwhom"
            },
        
        },
        
            
        Asktheday: {          //changed
            entry: [{
              type: "say",
              params: `You can have your meeting on ${days(grammar)}. Which day do you prefer?`,
            }],                     
            
            on: { SPEAK_COMPLETE: "ListenTheday" },
          },
          ListenTheday: {
            entry: ({ context }) =>
              context.ssRef.send({
                type: "LISTEN",
              }),
            on: { 
              RECOGNISED:[
            {
              guard: ({event}) => isInGrammar(event.value[0].utterance),//get//({context}) => context.result[0]utterance === 'maria', FUNCTION WHOLE DAY
              target: "Askwholeday", 
              actions: assign({
                Dayofmeeting: ({event}) => getDay(event.value[0].utterance),
            }),
              
          },
          {target : "#DM.Done"},
            ],
            //ASR_NOINPUT : "Canthear",
          },
        },

        
          Askwholeday: {
            entry: [{
              type: "say",
              params: `Will it take the whole day?`,
            }],
            on: { SPEAK_COMPLETE: "ListenThewholeday" },
              },

              ListenThewholeday:{
              entry: ({ context }) =>
              context.ssRef.send({
                type: "LISTEN",
              }),
            on: { 
              RECOGNISED:[ 
              {
                guard: ({event}) => isTheAnswerYes(event.value[0].utterance),
              target: "Verifyappointment"},
              
              {target: "AskTheTime"},
              
            ],
            //ASR_NOINPUT : "Canthear",
          },
      }, 
      

        AskTheTime: {
          entry: [{
            type: "say",
            params: `What time is your meeting?`,
          }],   
            on: { SPEAK_COMPLETE: "ListenTheTime"},

          },

          ListenTheTime: {
            entry: ({ context }) =>
              context.ssRef.send({
                type: "LISTEN",
              }),
            on: { 
              RECOGNISED:[
            {
              guard: ({event}) => isInGrammar(event.value[0].utterance),//get//({context}) => context.result[0]utterance === 'maria', FUNCTION WHOLE DAY
              target: "Verifyappointment", 
              actions: assign({
                Timeofmeeting: ({event}) => getTime(event.value[0].utterance),
            }),
          },
          {target : "#DM.Done"},
          ],
          //ASR_NOINPUT : "Canthear",
        },
      },

        Verifyappointment: {
          entry: ({ context }) =>
              context.ssRef.send({
                type: "SPEAK",
                value: {
                    utterance: `Do you want to create an appointment with ${context.MeetingWithwhom} on ${context.Dayofmeeting} at ${context.Timeofmeeting}?`,
                      },
                    }),
            on: {SPEAK_COMPLETE: "NegPosVerif"},
          },
        NegPosVerif: {
          entry: ({ context }) =>
          context.ssRef.send({
            type: "LISTEN",
          }),
          on: {
              RECOGNISED:[ 
              {
                guard: ({event}) => isTheAnswerYes(event.value[0].utterance),
              //get//({context}) => context.result[0]utterance === 'maria', FUNCTION WHOLE DAY
              target: "CreateAppointment"}, 
              {target: "#DM.PromptAndAsk.Prompt"},
              ],
           // ASR_NOINPUT : "Canthear",
          },
        },
        
        CreateAppointment:{
          entry: [{
            type: "say",
            params: `Your appointment has been created.`,
          }],   
                
          on: {SPEAK_COMPLETE: "#DM.Done"},
          },},},
          Done:{
            on:{
              CLICK : "PromptAndAsk"
            },
          },
        },});
            


const dmActor = createActor(dmMachine, {
  inspect: inspector.inspect,
}).start();

dmActor.subscribe((state) => {
  console.log(state)
});

export function setupButton(element) {
  element.addEventListener("click", () => {
    dmActor.send({ type: "CLICK" });
  });
  dmActor.getSnapshot().context.ssRef.subscribe((snapshot) => {
    element.innerHTML = `${snapshot.value.AsrTtsManager.Ready}`;
  });
}

