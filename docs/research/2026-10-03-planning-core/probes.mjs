// Read-only core probes: no product code, installation, model or external calls.
import {validateTasks, validateReadiness, chooseExecution} from '../../../lib/contracts.mjs';
import {receiveHandoff, acceptWork, createReturn} from '../../../lib/handoff.mjs';
const task={id:'0001',nodeType:'task',kind:'implementation',openDecisions:[],dependsOn:[],write:['src/app.js'],resources:[],scenarios:['demo/All'],verification:['node --test tests/app.test.mjs'],boundary:{change:'Implement the entire saved views feature',target:'Save, list, open and delete views',exclusions:['Unrelated features'],review:{verdict:'ready',source:'Coordinator says ready'}},body:['Outcome','Inputs','Acceptance','Verification','Definition of done'].map(h=>`## ${h}\nx\n`).join('\n')};
const nested=[{...task,id:'P0',nodeType:'package'},{...task,id:'P1',nodeType:'package',parentId:'P0'},{...task,parentId:'P1'}];
const pair=[task,{...task,id:'0002'}];
const work=acceptWork(receiveHandoff({objective:'Deliver a plan',project:'synthetic',scope:['planning'],constraints:[],risks:[],references:[],authorizations:[]}));
console.log(JSON.stringify({
  broadTaskWithMeaninglessSections:{structuralErrors:validateTasks([task]),readinessErrors:validateReadiness(task),interpretation:'Structural metadata is not a semantic plan-quality gate.'},
  nestedPlanningHierarchy:{errors:validateTasks(nested),interpretation:'Recursive containment is explicitly rejected.'},
  separateTasksSharingAFile:{graphErrors:validateTasks(pair),schedule:chooseExecution(pair,{spawn:true,isolatedWrites:true,maxParallel:2}),interpretation:'Shared file blocks parallelism, not separate contracts.'},
  planningReturnWithoutArtifactVerification:createReturn(work,{status:'completed',outcome:'Planning ready',evidence:['UNVERIFIED-TASKS.md'],remainingWork:[],limitations:['This is a structural probe, not a real delivery.']})
},null,2));
