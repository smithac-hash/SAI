import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import { getResults, TestResult } from '../lib/assessmentStore';

export default function HistoryScreen() {
  const [items, setItems] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => {
    let active = true;
    getResults().then(data => { if (active) setItems(data); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}>
    <Pressable onPress={() => router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
    <Text style={s.title}>Assessment History</Text>
    <Text style={s.sub}>Your saved test results, newest first.</Text>
    {loading ? <ActivityIndicator color="#14213D" /> : items.length === 0 ?
      <View style={s.card}><Text style={s.heading}>No saved assessments yet</Text><Text style={s.muted}>Complete a test and its result will appear here.</Text></View> :
      items.map(item => <View style={s.card} key={item.id}>
        <View style={s.row}><Text style={s.heading}>{item.test}</Text><Text style={s.value}>{item.value} {item.unit}</Text></View>
        <Text style={s.muted}>{new Date(item.date).toLocaleString()}</Text>
        {item.details && Object.entries(item.details).map(([k,v]) => <Text style={s.detail} key={k}>{k}: {v}</Text>)}
      </View>)}
    <Pressable style={s.button} onPress={() => router.push('/progress')}><Text style={s.buttonText}>View Progress</Text></Pressable>
  </ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#F5F7FA'},container:{padding:20,paddingBottom:40,maxWidth:650,width:'100%',alignSelf:'center'},back:{fontSize:17,color:'#14213D',marginBottom:18},title:{fontSize:28,fontWeight:'800',color:'#14213D'},sub:{color:'#64748B',marginTop:6,marginBottom:20},card:{backgroundColor:'#FFF',borderRadius:16,padding:18,marginBottom:12,borderWidth:1,borderColor:'#E2E8F0'},row:{flexDirection:'row',justifyContent:'space-between',gap:12},heading:{fontSize:17,fontWeight:'700',color:'#14213D'},value:{fontSize:17,fontWeight:'800',color:'#14213D'},muted:{color:'#64748B',marginTop:7,lineHeight:20},detail:{color:'#475569',marginTop:5},button:{backgroundColor:'#14213D',padding:16,borderRadius:12,alignItems:'center',marginTop:10},buttonText:{color:'#FFF',fontWeight:'700'}});
