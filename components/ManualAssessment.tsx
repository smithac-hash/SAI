import React,{useState} from 'react';
import {View,Text,TextInput,Pressable,StyleSheet,Alert,ScrollView} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import {saveResult} from '../lib/assessmentStore';

type Props={title:string;description:string;label:string;unit:string;test:string;hint:string};
export default function ManualAssessment({title,description,label,unit,test,hint}:Props){
 const [value,setValue]=useState('');
 const [saving,setSaving]=useState(false);
 const submit=async()=>{
  const n=Number(value);
  if(!value.trim()||!Number.isFinite(n)||n<=0){Alert.alert('Check your result',`Enter a valid ${label.toLowerCase()}.`);return;}
  setSaving(true);
  try{await saveResult({test,value:n,unit});Alert.alert('Result saved',`${title} result has been added to your assessment history.`,[{text:'OK',onPress:()=>router.replace('/results')}]);}
  catch{Alert.alert('Could not save','Please try again.');}
  finally{setSaving(false);}
 };
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}>
  <Pressable onPress={()=>router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
  <Text style={s.title}>{title}</Text><Text style={s.sub}>{description}</Text>
  <View style={s.card}><Text style={s.label}>{label} ({unit})</Text><TextInput style={s.input} value={value} onChangeText={setValue} keyboardType="decimal-pad" placeholder={`Enter ${label.toLowerCase()}`} placeholderTextColor="#94A3B8"/>
  <Text style={s.hint}>{hint}</Text><Pressable style={[s.button,saving&&{opacity:.6}]} disabled={saving} onPress={submit}><Text style={s.buttonText}>{saving?'Saving...':'Save Assessment Result'}</Text></Pressable></View>
  <Text style={s.note}>This screen records a manually measured result. Use a consistent protocol and equipment each time so progress comparisons are meaningful.</Text>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#F5F7FA'},container:{padding:20,paddingBottom:40,maxWidth:620,width:'100%',alignSelf:'center'},back:{fontSize:17,color:'#14213D',marginBottom:18},title:{fontSize:28,fontWeight:'800',color:'#14213D'},sub:{color:'#64748B',lineHeight:21,marginTop:6,marginBottom:20},card:{backgroundColor:'#FFF',padding:20,borderRadius:16,borderWidth:1,borderColor:'#E2E8F0'},label:{fontSize:15,fontWeight:'700',color:'#14213D'},input:{borderWidth:1,borderColor:'#CBD5E1',borderRadius:10,padding:14,fontSize:18,color:'#14213D',marginTop:10},hint:{color:'#64748B',fontSize:13,lineHeight:19,marginTop:10},button:{backgroundColor:'#14213D',padding:16,borderRadius:12,alignItems:'center',marginTop:20},buttonText:{color:'#FFF',fontWeight:'800'},note:{fontSize:12,color:'#64748B',lineHeight:18,marginTop:16}});
