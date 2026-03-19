import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime="nodejs";

const openai=new OpenAI({
  apiKey:process.env.OPENAI_API_KEY
});

export async function POST(req:Request){

  try{

    const formData=await req.formData();
    const file=formData.get("file") as File;

    if(!file){
      return NextResponse.json({error:"No file"},{status:400});
    }

    const response=await openai.audio.transcriptions.create({
      file,
      model:"whisper-1"
    });

    return NextResponse.json({
      text:response.text
    });

  }catch(error:any){

    console.error("TRANSCRIBE ERROR:",error);

    return NextResponse.json({
      error:"Transcription failed",
      details:error?.message
    },{status:500});
  }
}