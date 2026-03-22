import NetworkLogger from 'react-native-network-logger';
import { NETWORK_LOGGER_ENABLED } from '../constants/debugConfig';
import { View, Text } from 'react-native';

export default function DebugLogsScreen() {
  if (!NETWORK_LOGGER_ENABLED) {
    return <View style={{flex:1,justifyContent:'center',alignItems:'center'}}><Text>Network logging disabled</Text></View>;
  }
  return <NetworkLogger theme="dark" />;
}
