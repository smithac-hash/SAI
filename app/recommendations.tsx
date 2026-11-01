import React,{useCallback,useState} from 'react';
import {View,Text,ScrollView,Pressable,StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect,router} from 'expo-router';
import {getResults,TestResult} from '../lib/assessmentStore';

export default function RecommendationsScreen(){
 const [items,setItems]=useState<TestResult[]>([]);
 useFocusEffect(useCallback(()=>{let live=true;getResults().then(x=>{if(live)setItems(x)});return()=>{live=false}},[]));
 const latest=(test:string)=>items.find(x=>x.test===test);
 const squat=latest('Squats'), jump=latest('Vertical Jump'), push=latest('Push-ups'), agility=latest('Agility');
 const cards=[
  {title:'Athletics / sprinting',why:'Potential fit when explosive power and lower-body performance are strengths.',match:!!jump&&jump.value>0},
  {title:'Football / field sports',why:'Can suit athletes who show a combination of agility, lower-body endurance and power.',match:!!agility&&!!squat},
  {title:'Gymnastics / calisthenics',why:'Upper-body strength and body control are useful foundations to develop.',match:!!push&&!!squat},
  {title:'Badminton / racquet sports',why:'Agility, quick changes of direction and explosive movement are important qualities.',match:!!agility&&!!jump}
 ];
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}>
  <Pressable onPress={()=>router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
  <Text style={s.title}>Sports Recommendations</Text>
  <Text style={s.sub}>Suggestions based on which assessments you have completed. These are starting points, not validated talent predictions.</Text>
  {cards.map(c=><View key={c.title} style={s.card}><Text style={s.heading}>{c.title}</Text><Text style={s.body}>{c.why}</Text><Text style={s.tag}>{c.match?'Some relevant test data available':'Complete more tests to personalise this suggestion'}</Text></View>)}
  <View style={s.card}><Text style={s.heading}>Your available test data</Text>{[['Squats',squat],['Vertical Jump',jump],['Push-ups',push],['Agility',agility]].map(([n,v]:any)=><Text key={n} style={s.body}>{n}: {v?`${v.value} ${v.unit}`:'Not completed'}</Text>)}</View>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#F5F7FA'},container:{padding:20,paddingBottom:40,maxWidth:650,width:'100%',alignSelf:'center'},back:{fontSize:17,color:'#14213D',marginBottom:18},title:{fontSize:28,fontWeight:'800',color:'#14213D'},sub:{color:'#64748B',lineHeight:21,marginTop:6,marginBottom:18},card:{backgroundColor:'#FFF',borderRadius:16,padding:18,marginBottom:12,borderWidth:1,borderColor:'#E2E8F0'},heading:{fontSize:17,fontWeight:'800',color:'#14213D'},body:{color:'#475569',lineHeight:21,marginTop:8},tag:{color:'#64748B',fontSize:12,marginTop:10,fontWeight:'700'}});
