const STATE = {

mode:"edit",
borders:false,

character:{
name:"",
description:"",
requirements:"",
faceImage:null,
faceSize:75
},

skills:[]
};

function createSkill(){
return{
id:crypto.randomUUID(),
name:"",
description:"",
notes:"",
cooldown:"",
classes:"",
cost:[0,0,0,0,0],
image:null
};
}

/* minimum 4 skills */
for(let i=0;i<4;i++){
STATE.skills.push(createSkill());
}
