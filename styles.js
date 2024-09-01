import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0039',
    ...Platform.select({
      android: {
        elevation: 5,
      },
      ios: {
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.9,
        shadowRadius: 5,
      },
    }),
  },

  headerImage: {
    width: '100%',
    height: '100%',
    position:'absolute',
  },

  smallerHeaderImage: {
    width: '100%',
    height: 350,
    position: 'absolute',
    top: 80,
    borderRadius: 100,
    zIndex: 99,
  },

  menuItem: {
    top: 160,
    borderRadius: 20,
    padding: 10,
    backgroundColor: 'lightblue',
    ...Platform.select({
      android: {
        elevation: 5,
      },
      ios: {
        shadowColor: 'black',
            fontFamily: 'Inter',
    fontWeight:'200',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.7,
        shadowRadius: 10,
      },
    }),
  },
  menuItemText: {
    color: 'black',
    textAlign: 'center',
    fontFamily: 'Inter',
    fontWeight: '200',
    letterSpacing: 0.1,
    fontSize: 36,
  },
  centerText: {
    textAlign: 'center',
  },

  lightGreyButton: {
    borderRadius: 20,
    top: 180,
    padding: 10,
    backgroundColor: '#D3D3D3',
    ...Platform.select({
      android: {
        elevation: 5,
      },
      ios: {
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
    }),

    inputContainer:{
        color:"black",
    }
  },
  confirmButton: {

    ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,

    },
    backgroundColor: 'lightblue',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',

    elevation: 3,
  },
  confirmButtonText: {
    color: 'black',
    

    },
});

export default styles;
