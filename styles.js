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
    height: '110%',
    position: 'absolute',
    top: 0,
    bottom: 0,
  },

  smallerHeaderImage: {
    width: '100%',
    height: 350,
    position: 'absolute',
    top: 50,
    borderRadius: 10,
    zIndex: 99,
    opacity: 0.99,
  },

  menuItemContainer: {
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

  notificationContainer: {
    position: 'absolute',
    top: 80,
    width: '100%',
    backgroundColor: '#00000064',
    zIndex: 1000,
    paddingVertical: 10,
  },
  menuItem: {
    flex: 1,
    borderRadius: 20,
    padding: 10,
    marginHorizontal: 5,
    backgroundColor: '#4c84af',
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
    backgroundColor: '#fffffffc',
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
    color: 'white',
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: 0.3,
    fontSize: 18,
  },

  menuItemText: {
    color: 'white',
    textAlign: 'center',
    fontFamily: 'Roboto',
    fontWeight: '600',
    letterSpacing: 0.3,
    fontSize: 18,
  },

  confirmButtonText: {
    color: 'white',
  },
    // New styles for OmatTiedotScreen
  sectionContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    width: '100%',
    padding: 20,
    marginBottom: 40,
    marginTop: 20,
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
    color: '#8d8d8dff',
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
    color: '#000000ff',
    fontWeight: '500',
  },
  switchDescription: {
    fontSize: 14,
    color: '#d8d8d8ff',
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
    borderRadius: 2,
  },

  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 30,
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
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // Order history styles
  orderItem: {
    backgroundColor: '#f9f9f9',
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#000',
  },
  
  orderText: {
    fontSize: 14,
    color: '#121212ff',
    marginBottom: 2,
  },
  
  // Input styles for profile screen
  inputContainer: {
    marginBottom: 15,
  },
  
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#121212ff',
    marginBottom: 8,
  },
  
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#161616ff',
  },
  
  confirmButton: {
    backgroundColor: '#000',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },

  // Modern Snow Work Styling
  backgroundImage: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  
  overlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    zIndex: 0,
  },

  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    zIndex: 2,
  },

  profileHeaderText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },

  modernCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(10px)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    marginTop: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  cardHeaderText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
    flex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  infoButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 8,
  },

  modernSwitchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },

  switchContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  modernSwitchLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(49, 166, 185, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },

  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },

  modernOrderItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 0,
    padding: 16,
    marginBottom: 1,
    marginHorizontal: 0,
    marginLeft: 0,
    marginRight: 0,
    borderLeftWidth: 4,
    borderLeftColor: '#4c9dafff',
    width: '100%',
    alignSelf: 'stretch',
  },

  orderItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  orderItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  orderItemContent: {
    paddingLeft: 4,
  },

  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },

  orderItemText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
    opacity: 0.9,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  // Order Screen Header Styles
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
});



export default styles;

