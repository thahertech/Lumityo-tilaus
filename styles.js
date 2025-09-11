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
    borderRadius: 20,
    padding: 10,

    marginHorizontal: 5,
    backgroundColor: '#eee',
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
    fontWeight: '400',
    letterSpacing: 0.3,
    fontSize: 18,
  },

  confirmButtonText: {
    color: 'black',
  },
    // New styles for OmatTiedotScreen
  sectionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    width: '100%',
    padding: 20,
    marginBottom: 20,
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
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  switchDescription: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 5,
  },
  // Contact Buttons Styles
  contactButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
  },
  
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 15,
    marginHorizontal: 5,
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
  },
  
  phoneButton: {
    backgroundColor: '#000000ac', // Green for phone
  },
  
  emailButton: {
    backgroundColor: '#000000ac', // Blue for email
  },
  
  contactIcon: {
    marginRight: 8,
    padding: 2
  },
  
  contactButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});



export default styles;

