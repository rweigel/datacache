/* This is part of the netCDF package.
   Copyright 2006 University Corporation for Atmospheric Research/Unidata.
   See COPYRIGHT file for conditions of use.

   This is a simple example which reads a small dummy array, which was
   written by simple_xy_wr.java. This is intended to illustrate the use
   of the netCDF Java API.

   This example demonstrates the netCDF Java API.

   Full documentation of the netCDF Java API can be found at:
   http://www.unidata.ucar.edu/software/netcdf-java/
*/

import ucar.nc2.NetcdfFile;
import ucar.nc2.Variable;
import ucar.ma2.*;

import java.io.IOException;

public class Simple_xy_rd {

    public static void main(String args[]) throws Exception, java.lang.NullPointerException
    {


       // Open the file. The ReadOnly parameter tells netCDF we want
       // read-only access to the file.
       NetcdfFile dataFile = null;
       String filename = "g15_magneto_512ms_20140301_20140301.nc";
       // Open the file.
       try {

           dataFile = NetcdfFile.open(filename, null);

            Variable[] a;
            a = new Variable[7];
            a[0] = dataFile.findVariable("BX_2");
           
           // Retrieve the variable named "data"
            Variable dataVar = dataFile.findVariable("BX_1");
            Variable timeVar = dataFile.findVariable("time_tag");

            if (dataVar == null) {
                System.out.println("Cant find Variable BX_1");
                return;
            }

           // Read all the values from the "data" variable into memory.
            int [] shape = dataVar.getShape();
            int[] origin = new int[2];

            System.out.println(shape[0]);

            ArrayFloat.D1 VdataArray;
            ArrayFloat.D1 dataArray;
            ArrayDouble.D1 timeArray;

            VdataArray = (ArrayFloat.D1) a[0].read();
            dataArray = (ArrayFloat.D1) dataVar.read();
            timeArray = (ArrayDouble.D1) timeVar.read();

            float[] VdataIn = new float[shape[0]];
            float[] dataIn = new float[shape[0]];
            double[] timeIn = new double[shape[0]];

            for (int j=0; j<shape[0]; j++) {
                VdataIn[j] = VdataArray.get(j);
                dataIn[j] = dataArray.get(j);
                timeIn[j] = timeArray.get(j);
                System.out.println(timeIn[j] + " " + dataIn[j] + " " + VdataIn[j]);
             }

            //System.out.println(shape[]);

       // The file is closed no matter what by putting inside a try/catch block.
       } catch (java.io.IOException e) {
                e.printStackTrace();
                return;
//       }  catch (InvalidRangeException e) {
//                e.printStackTrace();
       } finally {
           if (dataFile != null)
           try {
             dataFile.close();
           } catch (IOException ioe) {
             ioe.printStackTrace();
           }
        }

    System.out.println( "*** SUCCESS reading example file simple_xy.nc!");

    }

}