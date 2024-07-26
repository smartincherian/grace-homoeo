import React, { useState } from 'react'
import Header from '../Header'
import Button from '@mui/material/Button';
import { Link } from 'react-router-dom';
import Box from '@mui/material/Box';
import PatientAdd from './PatientAdd';
import PatientSearch from './PatientSearch';

function PatientManagement() {

  const [addPatientView, setaddPatientView] = useState(false);
  const [searchPatientView, setsearchPatientView] = useState(true);

  const addPatientButtonHandler = () => {
    setaddPatientView(() => !addPatientView);
    setsearchPatientView(false);
  }

  const searchPatientButtonHandler = () => {
    setsearchPatientView(() => !searchPatientView);
    setaddPatientView(false);
  }

  return (
    <div>
      <Header page={'Patient Management'} />
      <div className='mt-16 text-center'>
        <Box justifyContent="space-between" display="flex" className='border-2 border-indigo-600 mt-6 p-4 ml-[30rem] mr-[30rem] ptmgmt-first-box'>
          <Button className='ptmgmt-items-button' variant="contained" onClick={addPatientButtonHandler}>Add New Patient</Button>
          <Button className='ptmgmt-items-button' variant="contained" onClick={searchPatientButtonHandler}>Search Existing Patient</Button>
        </Box>
      </div >

      {addPatientView && <PatientAdd />}

      {searchPatientView && <PatientSearch />}

    </div >
  )
}

export default PatientManagement