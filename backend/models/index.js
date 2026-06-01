// Central export — import any model from here:
// const { User, Employee, FlightRisk } = require('./models');

module.exports = {
  User:             require('./User'),
  Employee:         require('./Employee'),
  Attendance:       require('./Attendance'),
  Leave:            require('./Leave'),
  Payroll:          require('./Payroll'),
  Performance:      require('./Performance'),
  Job:              require('./Job'),
  Resume:           require('./Resume'),
  ScreeningSession: require('./ScreeningSession'),
  PolicyDocument:   require('./PolicyDocument'),
  RagChunk:         require('./RagChunk'),
  FlightRisk:       require('./FlightRisk'),
};
