import React from 'react';
import {StyleSheet,Text,View,Pressable,ScrollView,useWindowDimensions} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {router} from 'expo-router';
export default function HomeScreen(){
 const {width}=useWindowDimensions();
 const links=[['Start Assessment','Complete your fitness tests','/profile'],['Assessment History','Review saved results','/history'],['Progress Tracking','Compare your performance over time','/progress'],['Sports Recommendations','Explore sports that match your test profile','/recommendations'],['Athlete Report','Create a shareable PDF report','/results']] as const;
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.content}><View style={s.inner}>
 <Text style={[s.logo,{fontSize:Math.min(width*.1,38)}]}>SAI</Text><Text style={s.title}>Sports Assessment & Improvement</Text><Text style={s.sub}>Discover your athletic potential. Measure, understand and improve.</Text>
 {links.map(([title,desc,path],i)=><Pressable key={title} style={s.card} onPress={()=>router.push(path as any)}><View style={s.icon}><Text style={s.iconText}>{['🏃','📋','📈','🏆','📄'][i]}</Text></View><View style={{flex:1}}><Text style={s.cardTitle}>{title}</Text><Text style={s.cardDesc}>{desc}</Text></View><Text style={s.arrow}>›</Text></Pressable>)}
 <Text style={s.footer}>SAI • Athlete development starts with good measurements.</Text>
 </View></ScrollView></SafeAreaView>
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:'#F5F7FA'},content:{flexGrow:1,padding:20},inner:{width:'100%',maxWidth:620,alignSelf:'center',paddingTop:26},logo:{fontWeight:'900',color:'#14213D',letterSpacing:4,textAlign:'center'},title:{fontSize:23,fontWeight:'800',color:'#14213D',textAlign:'center',marginTop:8},sub:{fontSize:15,color:'#64748B',textAlign:'center',lineHeight:22,marginTop:8,marginBottom:24},card:{backgroundColor:'#FFF',borderRadius:16,padding:16,marginBottom:12,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:'#E2E8F0',gap:13},icon:{width:48,height:48,borderRadius:14,backgroundColor:'#EEF2F8',alignItems:'center',justifyContent:'center'},iconText:{fontSize:24},cardTitle:{fontSize:16,fontWeight:'800',color:'#14213D'},cardDesc:{fontSize:13,color:'#64748B',marginTop:4,lineHeight:18},arrow:{fontSize:28,color:'#64748B'},footer:{textAlign:'center',color:'#94A3B8',fontSize:12,marginTop:16}});
