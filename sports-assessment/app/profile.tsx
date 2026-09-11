import { StyleSheet, Text, View, TextInput, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';

export default function ProfileScreen() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');

  const handleContinue = () => {
    router.push({
      pathname: '/assessment',
      params: {
        name,
        age,
        gender,
        weight,
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Profile</Text>

      <TextInput
        style={styles.input}
        placeholder="Name"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Age"
        keyboardType="numeric"
        value={age}
        onChangeText={setAge}
      />

      <TextInput
        style={styles.input}
        placeholder="Gender"
        value={gender}
        onChangeText={setGender}
      />

      <TextInput
        style={styles.input}
        placeholder="Weight (kg)"
        keyboardType="numeric"
        value={weight}
        onChangeText={setWeight}
      />

      <Pressable
        style={styles.button}
        onPress={handleContinue}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 25,
    justifyContent: 'center',
  },

  title: {
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
  },

  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },

  button: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 15,
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});