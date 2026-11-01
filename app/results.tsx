import React,{useCallback,useState} from 'react';
import {View,Text,ScrollView,Pressable,StyleSheet,Alert,ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router,useFocusEffect} from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {getProfile,getResults,Athlete,TestResult} from '../lib/assessmentStore';

export default function ResultsScreen(){
 const [profile,setProfile]=useState<Athlete|null>(null);
 const [items,setItems]=useState<TestResult[]>([]);
 const [loading,setLoading]=useState(true);
 const [exporting,setExporting]=useState(false);
 useFocusEffect(useCallback(()=>{let live=true;Promise.all([getProfile(),getResults()]).then(([p,r])=>{if(live){setProfile(p);setItems(r)}}).catch(()=>Alert.alert('Could not load','Please reopen this screen.')).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]));
 const exportPdf=async()=>{
  if(!items.length){Alert.alert('No results yet','Complete at least one assessment before creating a report.');return;}
  setExporting(true);
  try{
   const rows=items.map(x=>`<tr><td>${x.test}</td><td>${x.value} ${x.unit}</td><td>${new Date(x.date).toLocaleDateString()}</td></tr>`).join('');
   const html=`<html><body style="font-family:Arial;padding:28px;color:#14213D"><h1>SAI Athlete Assessment Report</h1><p>Sports Assessment & Improvement</p><hr/><h2>Athlete Profile</h2><p>Name: ${profile?.name||'Not provided'}<br/>Age: ${profile?.age||'—'}<br/>Gender: ${profile?.gender||'—'}<br/>Weight: ${profile?.weight?profile.weight+' kg':'—'}</p><h2>Assessment Results</h2><table style="width:100%;border-collapse:collapse"><tr><th align="left">Test</th><th align="left">Result</th><th align="left">Date</th></tr>${rows}</table><p style="margin-top:30px;color:#64748B;font-size:11px">Results are measurements recorded in SAI. Follow consistent test protocols. They are not medical diagnoses or validated talent predictions.</p></body></html>`;
   const file=await Print.printToFileAsync({html});
   const canShare=await Sharing.isAvailableAsync();
   if(canShare) await Sharing.shareAsync(file.uri,{mimeType:'application/pdf',dialogTitle:'Share SAI Athlete Report'});
   else Alert.alert('PDF created',`Your report was saved to ${file.uri}`);
  }catch(e){Alert.alert('Export failed','Could not create the PDF. Please try again.');}
  finally{setExporting(false)}
 };
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}>
  <Pressable onPress={()=>router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
  <Text style={s.title}>Your Results</Text>
  {profile&&<View style={s.profile}><Text style={s.profileTitle}>{profile.name}</Text><Text style={s.profileText}>Age {profile.age} · {profile.gender} · {profile.weight} kg</Text></View>}
  <Text style={s.section}>Performance Breakdown</Text>
  {loading?<ActivityIndicator color="#14213D"/>:items.length===0?<View style={s.empty}><Text style={s.heading}>No assessment results yet</Text><Text style={s.muted}>Complete a test to see your results here. Your saved assessments will remain available when you reopen the app.</Text></View>:items.map(item=><View style={s.card} key={item.id}><View style={s.row}><Text style={s.label}>{item.test}</Text><Text style={s.value}>{item.value} {item.unit}</Text></View><Text style={s.muted}>{new Date(item.date).toLocaleString()}</Text>{item.details&&Object.entries(item.details).map(([k,v])=><Text style={s.detail} key={k}>{k}: {v}</Text>)}</View>)}
  <Pressable style={[s.button,exporting&&{opacity:.6}]} onPress={exportPdf} disabled={exporting}><Text style={s.buttonText}>{exporting?'Preparing PDF...':'Download / Share PDF Report'}</Text></Pressable>
  <Pressable style={s.secondary} onPress={()=>router.push('/history')}><Text style={s.secondaryText}>View Assessment History</Text></Pressable>
  <Pressable style={s.secondary} onPress={()=>router.push('/recommendations')}><Text style={s.secondaryText}>Sports Recommendations</Text></Pressable>
  <Pressable style={s.secondary} onPress={()=>router.replace('/')}><Text style={s.secondaryText}>Back to Home</Text></Pressable>
  <Text style={s.note}>SAI records test measurements and provides general guidance. Results should be interpreted using consistent protocols and should not be treated as validated talent rankings.</Text>
 </ScrollView></SafeAreaView>
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#F5F7FA'},container:{padding:20,paddingBottom:40,maxWidth:650,width:'100%',alignSelf:'center'},back:{fontSize:17,color:'#14213D',marginBottom:18},title:{fontSize:30,fontWeight:'900',color:'#14213D',textAlign:'center',marginBottom:22},profile:{backgroundColor:'#14213D',borderRadius:16,padding:18,marginBottom:22},profileTitle:{fontSize:20,fontWeight:'800',color:'#FFF'},profileText:{fontSize:14,color:'#CBD5E1',marginTop:6},section:{fontSize:20,fontWeight:'800',color:'#14213D',marginBottom:12},card:{backgroundColor:'#FFF',borderRadius:14,padding:17,marginBottom:10,borderWidth:1,borderColor:'#E2E8F0'},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},label:{fontSize:16,fontWeight:'700',color:'#334155',flexShrink:1},value:{fontSize:17,fontWeight:'900',color:'#14213D'},muted:{fontSize:13,color:'#64748B',marginTop:7,lineHeight:19},detail:{fontSize:13,color:'#475569',marginTop:5},empty:{backgroundColor:'#FFF',borderRadius:14,padding:20},heading:{fontSize:18,fontWeight:'800',color:'#14213D'},button:{backgroundColor:'#14213D',padding:16,borderRadius:12,alignItems:'center',marginTop:18},buttonText:{color:'#FFF',fontWeight:'800',fontSize:15},secondary:{backgroundColor:'#FFF',padding:15,borderRadius:12,alignItems:'center',marginTop:10,borderWidth:1,borderColor:'#CBD5E1'},secondaryText:{color:'#14213D',fontWeight:'700'},note:{fontSize:12,color:'#64748B',lineHeight:18,marginTop:18}});
