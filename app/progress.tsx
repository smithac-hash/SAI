import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { getResults, TestResult } from '../lib/assessmentStore';

export default function ProgressScreen() {
 const [items,setItems]=useState<TestResult[]>([]);
 useFocusEffect(useCallback(()=>{let live=true;getResults().then(x=>{if(live)setItems(x)});return()=>{live=false}},[]));
 const groups = Array.from(new Set(items.map(x=>x.test)));
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}>
  <Pressable onPress={()=>router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
  <Text style={s.title}>Your Progress</Text><Text style={s.sub}>Compare your latest result with your previous result for each test.</Text>
  {groups.length===0 ? <View style={s.card}><Text style={s.heading}>Not enough data yet</Text><Text style={s.muted}>Complete and save assessments to see your progress.</Text></View> :
   groups.map(name=>{const list=items.filter(x=>x.test===name);const latest=list[0];const previous=list[1];const delta=previous?latest.value-previous.value:null;return <View style={s.card} key={name}>
    <Text style={s.heading}>{name}</Text><Text style={s.value}>{latest.value} {latest.unit}</Text>
    <Text style={s.muted}>{previous?`Previous: ${previous.value} ${previous.unit} · Change: ${delta!>0?'+':''}${delta} ${latest.unit}`:'Complete this test again to create a comparison.'}</Text>
    <Text style={s.date}>Latest: {new Date(latest.date).toLocaleDateString()}</Text>
   </View>})}
  <Text style={s.note}>For time-based tests, a lower time may represent improvement. SAI currently displays raw changes and does not assign a universal performance grade.</Text>
 </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#F5F7FA'},container:{padding:20,paddingBottom:40,maxWidth:650,width:'100%',alignSelf:'center'},back:{fontSize:17,color:'#14213D',marginBottom:18},title:{fontSize:28,fontWeight:'800',color:'#14213D'},sub:{color:'#64748B',marginTop:6,marginBottom:20,lineHeight:21},card:{backgroundColor:'#FFF',borderRadius:16,padding:18,marginBottom:12,borderWidth:1,borderColor:'#E2E8F0'},heading:{fontSize:17,fontWeight:'700',color:'#14213D'},value:{fontSize:30,fontWeight:'900',color:'#14213D',marginTop:8},muted:{color:'#475569',marginTop:6,lineHeight:20},date:{color:'#94A3B8',marginTop:8,fontSize:12},note:{color:'#64748B',fontSize:12,lineHeight:18,marginTop:10}});
