import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    ...Platform.select({
      android: {
        elevation: 5,
      },
      ios: {
        shadowColor: 'black',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.9,
        shadowRadius: 5,
        backgroundColor:'transparent',
      },
    }),
  },


  headerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },

  smallerHeaderImage: {
    width: '100%',
    height: 350,
    position: 'absolute',
    top: 25,
    borderRadius: 10,
    zIndex: 99,
    opacity: 0.99,
  },

  menuItemContainer: {
    top: 120,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20, // some top margin
    width: '80%',
  },
  menuItemContainer1: {
    top: 160,
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignContent: 'center',
    alignSelf: 'center',
    marginTop: 20,
    width: '40%',
    whiteSpace: 'none',
  },

  menuItem: {
    flex: 1,
    borderRadius: 10,
    padding: 10,

    marginHorizontal: 5,
    backgroundColor: 'lightblue',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      android: {
        elevation: 5,
      },
      ios: {
        shadowColor: 'black',
        fontWeight: '200',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.7,
        shadowRadius: 10,
      },
    }),
  },
menuItem1: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    textWrap: 'nowrap',
    marginHorizontal: 5,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      android: {
        elevation: 5,
      },
      ios: {
        shadowColor: 'black',
        fontWeight: '200',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.7,
        shadowRadius: 10,
      },
    }),
  },
  menuItemTextSmall: {
    color: 'black',
    textAlign: 'center',
    fontWeight: '200',
    letterSpacing: 0.3,
    fontSize: 18,
  },

  menuItemText: {
    color: 'black',
    textAlign: 'center',
    fontWeight: '300',
    letterSpacing: 0.3,
    fontSize: 24,
  },

  confirmButtonText: {
    color: 'black',
  },
});


export default styles;
