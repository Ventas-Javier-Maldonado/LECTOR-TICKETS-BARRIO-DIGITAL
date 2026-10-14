import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
env.allowLocalModels = false;
let reader;
let canceled = false;
self.onmessage = async ({data}) => {
  if(data.type === 'cancel'){ canceled = true; return; }
  if(data.type !== 'read') return;
  canceled = false;
  try {
    if(!reader){
      self.postMessage({type:'status',message:'Descargando o cargando el modelo TrOCR Small. La primera vez puede tardar varios minutos y consumir datos.'});
      reader = await pipeline('image-to-text','Xenova/trocr-small-handwritten',{quantized:true,progress_callback:(p)=>{
        if(p.status === 'progress' && p.file){self.postMessage({type:'progress',message:`Modelo: ${p.file.split('/').pop()} · ${Math.round(p.progress || 0)}%`});}
      }});
    }
    for(let i=0;i<data.lines.length;i++){
      if(canceled){self.postMessage({type:'cancelled'});return;}
      self.postMessage({type:'status',message:`Leyendo renglón ${i+1} de ${data.lines.length}…`});
      const out = await reader(data.lines[i].data,{max_new_tokens:100});
      self.postMessage({type:'result',id:data.lines[i].id,text:out?.[0]?.generated_text || ''});
    }
    self.postMessage({type:'done'});
  } catch(err){self.postMessage({type:'error',message:String(err?.message||err)});}
};
